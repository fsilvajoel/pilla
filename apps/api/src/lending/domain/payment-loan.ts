import type { LateTerms } from "@pilla/finance";
import type { LoanStatus } from "./loan-status";

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
