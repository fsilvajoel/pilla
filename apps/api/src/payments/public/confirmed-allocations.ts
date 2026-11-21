import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { readConfirmedAllocations, type ConfirmedAllocation, type ConfirmedPayment } from "../infra/allocation-reader";

export type { ConfirmedAllocation, ConfirmedPayment };

/** Alocações confirmadas e não estornadas do contrato, somadas por parcela e por componente. */
export function confirmedAllocationsByLoan(
  db: PgDatabase<PgQueryResultHKT>,
  loanId: string,
): Promise<ConfirmedAllocation[]> {
  return readConfirmedAllocations(db, loanId);
}
