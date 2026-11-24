import { Inject, Injectable } from "@nestjs/common";
import { isoDate } from "@pilla/finance";
import {
  idSchema,
  portalLoanDetailResponse,
  portalLoanListResponse,
  type PortalLoanDetailResponse,
  type PortalLoanListItem,
  type PortalLoanListResponse,
  type PortalSituation,
} from "@pilla/schemas";
import { ProblemException } from "../../core/http/problem-exception";
import { DATABASE, type Database } from "../../db/database";
import { confirmedAllocationsByLoan } from "../../payments/public/confirmed-allocations";
import { confirmedPaymentsOfLoan } from "../../payments/public/loan-payments";
import { selectInstallmentsByLoan, selectPortalLoan, selectPortalLoans } from "../infra/loan-queries";
import type { LoanRow } from "../infra/schema";
import { assessLoan, type LoanAssessment } from "./loan-assessment";
import { todayInBrasilia } from "./today";

// Igual para "não é seu", "não existe" e "não é um id": o corpo não pode dizer qual (E15 D10).
const NOT_FOUND_DETAIL = "Recurso não encontrado.";

const situationOf = (loan: LoanRow, assessment: LoanAssessment): PortalSituation => {
  if (loan.status === "PAID_OFF") return "PAID_OFF";
  return assessment.standing === "OVERDUE" ? "OVERDUE" : "CURRENT";
};

// Leituras do cliente (RF-61, RF-62, RF-63): a pessoa vem só da sessão, nada é gravado (ADR-0005, E15 D11) e cada
// campo é copiado um a um para o DTO do portal, nunca a linha inteira (ADR-0007).
@Injectable()
export class PortalLoansService {
  private readonly db: Database;

  constructor(@Inject(DATABASE) db: Database) {
    this.db = db;
  }

  async list(personId: string): Promise<PortalLoanListResponse> {
    const loans = await selectPortalLoans(this.db, personId);
    const installments = await selectInstallmentsByLoan(
      this.db,
      loans.map((loan) => loan.id),
    );
    const today = isoDate(todayInBrasilia(new Date()));
    const items: PortalLoanListItem[] = [];
    for (const loan of loans) {
      const allocations = await confirmedAllocationsByLoan(this.db, loan.id);
      const assessment = assessLoan(loan, installments.get(loan.id) ?? [], allocations, today);
      items.push({
        id: loan.id,
        loanNumber: loan.loanNumber,
        principalCents: loan.principalCents,
        outstandingCents: assessment.outstandingCents,
        situation: situationOf(loan, assessment),
        nextDueDate: assessment.nextDueDate,
      });
    }
    return portalLoanListResponse.parse({ items });
  }

  async detail(personId: string, id: string): Promise<PortalLoanDetailResponse> {
    const loan = idSchema.safeParse(id).success ? await selectPortalLoan(this.db, personId, id) : null;
    if (loan === null) throw new ProblemException("NOT_FOUND", NOT_FOUND_DETAIL);
    const installments = (await selectInstallmentsByLoan(this.db, [loan.id])).get(loan.id) ?? [];
    const allocations = await confirmedAllocationsByLoan(this.db, loan.id);
    const assessment = assessLoan(loan, installments, allocations, isoDate(todayInBrasilia(new Date())));
    const situation = situationOf(loan, assessment);
    const next = assessment.installments.find((installment) => installment.status !== "PAID");
    const payments = await confirmedPaymentsOfLoan(this.db, loan.id);
    return portalLoanDetailResponse.parse({
      id: loan.id,
      loanNumber: loan.loanNumber,
      situation,
      principalCents: loan.principalCents,
      totalCents: assessment.totalCents,
      paidCents: assessment.paidCents,
      outstandingCents: assessment.outstandingCents,
      lateChargesCents: assessment.installments.reduce((sum, installment) => sum + installment.lateChargesCents, 0),
      nextInstallment:
        situation === "PAID_OFF" || next === undefined
          ? null
          : {
              number: next.number,
              dueDate: next.dueDate,
              amountCents: Math.max(0, next.totalCents - next.paidCents),
            },
      installments: assessment.installments.map((installment) => ({
        number: installment.number,
        dueDate: installment.dueDate,
        amountCents: installment.totalCents,
        paidCents: installment.paidCents,
        lateChargesCents: installment.lateChargesCents,
        status: installment.status,
      })),
      payments: payments.map((payment) => ({
        paidAt: payment.paidAt,
        amountCents: payment.amountCents,
        method: payment.method,
      })),
    });
  }
}
