import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import {
  readConfirmedAllocations,
  readConfirmedAllocationsForLoans,
  type ConfirmedAllocation,
  type ConfirmedPayment,
} from "../infra/allocation-reader";

export type { ConfirmedAllocation, ConfirmedPayment };

/** Alocações confirmadas e não estornadas do contrato, somadas por parcela e por componente. */
export function confirmedAllocationsByLoan(
  db: PgDatabase<PgQueryResultHKT>,
  loanId: string,
): Promise<ConfirmedAllocation[]> {
  return readConfirmedAllocations(db, loanId);
}

/** Mesma leitura para vários contratos numa consulta só; contrato sem alocação confirmada fica fora do mapa. */
export function confirmedAllocationsByLoans(
  db: PgDatabase<PgQueryResultHKT>,
  loanIds: readonly string[],
): Promise<Map<string, ConfirmedAllocation[]>> {
  return readConfirmedAllocationsForLoans(db, loanIds);
}
