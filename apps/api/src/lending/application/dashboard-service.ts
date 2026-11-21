import { Inject, Injectable } from "@nestjs/common";
import { addDays, isoDate } from "@pilla/finance";
import { dashboardTodayResponse, type DashboardTodayResponse } from "@pilla/schemas";
import { DATABASE, type Database } from "../../db/database";
import { confirmedAllocationsByLoan } from "../../payments/public/confirmed-allocations";
import { listPendingReviewPayments } from "../../payments/public/pending-payments";
import { findPersonNames } from "../../people/public/person-lookup";
import { selectActiveLoans, selectInstallmentsByLoan, selectLoansByIds } from "../infra/loan-queries";
import { groupDashboardInstallments, pendingReviewBlock, WEEK_DAYS, type DashboardLoan } from "./dashboard-today";
import { personNameOf } from "./loans-service";
import { todayInBrasilia } from "./today";

/** Teto de itens da porta (padrão dela é 50): o painel mostra até 200 pendentes; count e total cobrem todos. */
const PENDING_REVIEW_LIMIT = 200;

// Painel (E13-F02A): lê os contratos ACTIVE e devolve o que vence e o que atrasou; nada é gravado (ADR-0005).
@Injectable()
export class DashboardService {
  private readonly db: Database;

  constructor(@Inject(DATABASE) db: Database) {
    this.db = db;
  }

  async today(): Promise<DashboardTodayResponse> {
    const referenceDate = isoDate(todayInBrasilia(new Date()));
    const loans = await selectActiveLoans(this.db);
    const installmentsByLoan = await selectInstallmentsByLoan(
      this.db,
      loans.map((loan) => loan.id),
    );
    const names = await findPersonNames(this.db, [...new Set(loans.map((loan) => loan.personId))]);
    const entries: DashboardLoan[] = [];
    for (const loan of loans) {
      entries.push({
        loan,
        personName: personNameOf(names, loan.personId),
        installments: installmentsByLoan.get(loan.id) ?? [],
        allocations: await confirmedAllocationsByLoan(this.db, loan.id),
      });
    }
    const pending = await listPendingReviewPayments(this.db, { limit: PENDING_REVIEW_LIMIT });
    const pendingLoans = await selectLoansByIds(this.db, [...new Set(pending.items.map((item) => item.loanId))]);
    const pendingNames = await findPersonNames(this.db, [...new Set(pending.items.map((item) => item.personId))]);
    return dashboardTodayResponse.parse({
      referenceDate,
      weekEndDate: addDays(referenceDate, WEEK_DAYS),
      ...groupDashboardInstallments(entries, referenceDate),
      pendingReview: pendingReviewBlock(pending, pendingLoans, pendingNames),
    });
  }
}
