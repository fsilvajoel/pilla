import { and, eq, isNull, sql } from "drizzle-orm";
import type { Database } from "../../db/database";
import { paymentAllocations, payments } from "./schema";

export type ConfirmedAllocation = {
  readonly installmentId: string;
  readonly principalCents: number;
  readonly interestCents: number;
  readonly lateChargesCents: number;
};

/** Soma por parcela as alocações não estornadas de pagamentos CONFIRMED do contrato. */
export async function readConfirmedAllocations(db: Database, loanId: string): Promise<ConfirmedAllocation[]> {
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
  }));
}
