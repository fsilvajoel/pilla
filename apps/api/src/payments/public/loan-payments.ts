import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { selectConfirmedPayments, type ConfirmedPaymentView } from "../infra/payment-repository";

export type { ConfirmedPaymentView };

/**
 * Pagamentos que o cliente vê no portal (RF-62, E15 D9): CONFIRMED e não estornados, mais antigos primeiro, só data,
 * valor e forma. Nenhum id, conta, comprovante nem chave Pix sai do módulo.
 */
export function confirmedPaymentsOfLoan(
  db: PgDatabase<PgQueryResultHKT>,
  loanId: string,
): Promise<ConfirmedPaymentView[]> {
  return selectConfirmedPayments(db, loanId);
}
