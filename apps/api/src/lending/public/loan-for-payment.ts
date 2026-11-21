import type { Database } from "../../db/database";
import type { PaymentLoan } from "../domain/payment-loan";
import { readLoanNumbers, readPaymentLoan } from "../infra/payment-loan-reader";

export type { PaymentLoan, PaymentLoanInstallment } from "../domain/payment-loan";

/** Lê o contrato para pagamentos; `forUpdate` trava a linha dentro da transação de quem chama. */
export function loadLoanForPayment(
  db: Database,
  loanId: string,
  opts?: { readonly forUpdate?: boolean },
): Promise<PaymentLoan | null> {
  return readPaymentLoan(db, loanId, opts?.forUpdate === true);
}

/** Número do contrato por id, para as listas; ids desconhecidos ficam de fora. */
export function findLoanNumbers(db: Database, ids: readonly string[]): Promise<Map<string, string>> {
  return readLoanNumbers(db, ids);
}
