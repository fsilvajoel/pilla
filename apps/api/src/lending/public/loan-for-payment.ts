import type { LateTerms } from "@pilla/finance";
import type { Database } from "../../db/database";
import type { LoanStatus } from "../domain/loan-status";

/** Parcela do contrato como o módulo de pagamentos a enxerga (valores em centavos, sem linha do Drizzle). */
export type PaymentLoanInstallment = {
  readonly id: string;
  readonly number: number;
  readonly dueDate: string;
  readonly principalCents: number;
  readonly interestCents: number;
};

/** Contrato como o módulo de pagamentos o enxerga (E11 D3). */
export type PaymentLoan = {
  readonly id: string;
  readonly loanNumber: string;
  readonly personId: string;
  readonly status: LoanStatus;
  readonly accountId: string | null;
  readonly disbursedAt: string | null;
  /** Contrato cujo `origin_loan_id` é este (renovação ou renegociação), quando houver. */
  readonly successorLoanId: string | null;
  readonly lateTerms: LateTerms;
  readonly installments: readonly PaymentLoanInstallment[];
};

/** Esboço (E11-T01): implementado na E11-T02. */
export function loadLoanForPayment(
  _db: Database,
  _loanId: string,
  _opts?: { readonly forUpdate?: boolean },
): Promise<PaymentLoan | null> {
  return Promise.reject(new Error("esboço: não implementado"));
}

/** Esboço (E11-T01): número do contrato por id, para as listas. */
export function findLoanNumbers(_db: Database, _ids: readonly string[]): Promise<Map<string, string>> {
  return Promise.reject(new Error("esboço: não implementado"));
}
