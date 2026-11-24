import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { paymentAllocations, payments } from "./schema";

/** Pagamento confirmado e não estornado de uma parcela: data e os três componentes pagos. */
export type ConfirmedPayment = {
  readonly paidAt: string;
  readonly lateChargesCents: number;
  readonly interestCents: number;
  readonly principalCents: number;
};

export type ConfirmedAllocation = {
  readonly installmentId: string;
  readonly principalCents: number;
  readonly interestCents: number;
  readonly lateChargesCents: number;
  /** Pagamentos da parcela em ordem de `paidAt` (histórico para os encargos, E11 D11). */
  readonly payments: readonly ConfirmedPayment[];
};

/** Por contrato e parcela, as alocações não estornadas de pagamentos CONFIRMED: soma e histórico por `paidAt`. */
export async function readConfirmedAllocationsForLoans(
  db: PgDatabase<PgQueryResultHKT>,
  loanIds: readonly string[],
): Promise<Map<string, ConfirmedAllocation[]>> {
  const result = new Map<string, ConfirmedAllocation[]>();
  if (loanIds.length === 0) return result;
  const rows = await db
    .select({
      loanId: paymentAllocations.loanId,
      installmentId: paymentAllocations.installmentId,
      paidAt: payments.paidAt,
      principalCents: sql<string>`sum(${paymentAllocations.principalCents})`,
      interestCents: sql<string>`sum(${paymentAllocations.interestCents})`,
      lateChargesCents: sql<string>`sum(${paymentAllocations.lateChargesCents})`,
    })
    .from(paymentAllocations)
    .innerJoin(payments, eq(payments.id, paymentAllocations.paymentId))
    .where(
      and(
        inArray(paymentAllocations.loanId, [...loanIds]),
        isNull(paymentAllocations.reversedAt),
        eq(payments.status, "CONFIRMED"),
        isNull(payments.reversedAt),
      ),
    )
    .groupBy(paymentAllocations.loanId, paymentAllocations.installmentId, payments.id, payments.paidAt)
    .orderBy(payments.paidAt, payments.id);
  const byLoan = new Map<string, Map<string, ConfirmedPayment[]>>();
  for (const row of rows) {
    const byInstallment = byLoan.get(row.loanId) ?? new Map<string, ConfirmedPayment[]>();
    const history = byInstallment.get(row.installmentId) ?? [];
    history.push({
      paidAt: row.paidAt,
      principalCents: Number(row.principalCents),
      interestCents: Number(row.interestCents),
      lateChargesCents: Number(row.lateChargesCents),
    });
    byInstallment.set(row.installmentId, history);
    byLoan.set(row.loanId, byInstallment);
  }
  const total = (history: readonly ConfirmedPayment[], pick: (item: ConfirmedPayment) => number): number =>
    history.reduce((sum, item) => sum + pick(item), 0);
  for (const [loanId, byInstallment] of byLoan) {
    result.set(
      loanId,
      [...byInstallment].map(([installmentId, history]) => ({
        installmentId,
        principalCents: total(history, (item) => item.principalCents),
        interestCents: total(history, (item) => item.interestCents),
        lateChargesCents: total(history, (item) => item.lateChargesCents),
        payments: history,
      })),
    );
  }
  return result;
}

/** Por parcela, as alocações não estornadas de pagamentos CONFIRMED do contrato: soma e histórico por `paidAt`. */
export async function readConfirmedAllocations(
  db: PgDatabase<PgQueryResultHKT>,
  loanId: string,
): Promise<ConfirmedAllocation[]> {
  return (await readConfirmedAllocationsForLoans(db, [loanId])).get(loanId) ?? [];
}
