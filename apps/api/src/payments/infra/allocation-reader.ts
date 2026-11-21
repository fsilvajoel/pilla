import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { and, eq, isNull, sql } from "drizzle-orm";
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

/** Soma por parcela as alocações não estornadas de pagamentos CONFIRMED do contrato. */
export async function readConfirmedAllocations(
  db: PgDatabase<PgQueryResultHKT>,
  loanId: string,
): Promise<ConfirmedAllocation[]> {
  const rows = await db
    .select({
      installmentId: paymentAllocations.installmentId,
      principalCents: sql<string>`sum(${paymentAllocations.principalCents})`,
      interestCents: sql<string>`sum(${paymentAllocations.interestCents})`,
      lateChargesCents: sql<string>`sum(${paymentAllocations.lateChargesCents})`,
    })
    .from(paymentAllocations)
    .innerJoin(payments, eq(payments.id, paymentAllocations.paymentId))
    .where(
      and(
        eq(paymentAllocations.loanId, loanId),
        isNull(paymentAllocations.reversedAt),
        eq(payments.status, "CONFIRMED"),
        isNull(payments.reversedAt),
      ),
    )
    .groupBy(paymentAllocations.installmentId);
  return rows.map((row) => ({
    installmentId: row.installmentId,
    principalCents: Number(row.principalCents),
    interestCents: Number(row.interestCents),
    lateChargesCents: Number(row.lateChargesCents),
    payments: [], // esboço do E11-T14
  }));
}
