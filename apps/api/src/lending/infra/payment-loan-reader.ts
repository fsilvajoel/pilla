import { bps, cents, type LateTerms } from "@pilla/finance";
import { loanStatusSchema } from "@pilla/schemas";
import { asc, eq, inArray } from "drizzle-orm";
import type { Database } from "../../db/database";
import type { PaymentLoan } from "../domain/payment-loan";
import { installments, loans, type LoanRow } from "./schema";

/** Condições de atraso copiadas no contrato (ADR-0008). */
function lateTermsOf(loan: LoanRow): LateTerms {
  return {
    finePercent: bps(BigInt(loan.lateFeeBps)),
    lateInterestMonthlyRate: bps(BigInt(loan.lateInterestMonthlyBps)),
    graceDays: loan.gracePeriodDays,
    roundingStep: cents(BigInt(loan.roundingStepCents)),
  };
}

/** Contrato, parcelas e sucessor lidos para o módulo de pagamentos; `forUpdate` trava a linha do contrato. */
export async function readPaymentLoan(db: Database, loanId: string, forUpdate: boolean): Promise<PaymentLoan | null> {
  const query = db.select().from(loans).where(eq(loans.id, loanId));
  const loan = (await (forUpdate ? query.for("update") : query))[0];
  if (loan === undefined) return null;
  const rows = await db
    .select()
    .from(installments)
    .where(eq(installments.loanId, loanId))
    .orderBy(asc(installments.number));
  const successors = await db.select({ id: loans.id }).from(loans).where(eq(loans.originLoanId, loanId)).limit(1);
  return {
    id: loan.id,
    loanNumber: loan.loanNumber,
    personId: loan.personId,
    status: loanStatusSchema.parse(loan.status),
    accountId: loan.accountId,
    disbursedAt: loan.disbursedAt,
    successorLoanId: successors[0]?.id ?? null,
    lateTerms: lateTermsOf(loan),
    installments: rows.map((row) => ({
      id: row.id,
      number: row.number,
      dueDate: row.dueDate,
      principalCents: row.principalCents,
      interestCents: row.interestCents,
    })),
  };
}

/** Número do contrato por id; ids desconhecidos ficam de fora. */
export async function readLoanNumbers(db: Database, ids: readonly string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({ id: loans.id, loanNumber: loans.loanNumber })
    .from(loans)
    .where(inArray(loans.id, [...ids]));
  return new Map(rows.map((row) => [row.id, row.loanNumber]));
}
