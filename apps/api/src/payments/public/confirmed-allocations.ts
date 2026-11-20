import type { Database } from "../../db/database";
import { readConfirmedAllocations, type ConfirmedAllocation } from "../infra/allocation-reader";

export type { ConfirmedAllocation };

/** Alocações confirmadas e não estornadas do contrato, somadas por parcela e por componente. */
export function confirmedAllocationsByLoan(db: Database, loanId: string): Promise<ConfirmedAllocation[]> {
  return readConfirmedAllocations(db, loanId);
}
