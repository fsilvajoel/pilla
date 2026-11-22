import type { AllocationPreviewResponse, PaymentResponse } from "@pilla/schemas";
import { ApiProblem } from "@/lib/api/problem";
import { toActionError } from "@/lib/people-action-result";

/** Resultado das ações de pagamento para a tela; erro sem detalhe interno. */
export type PaymentActionResult<T = null> =
  | { readonly ok: true; readonly data: T }
  | {
      readonly ok: false;
      readonly code: string | null;
      readonly message: string;
      readonly fieldErrors: Readonly<Record<string, string>>;
      /** contrato sucessor, só em LOAN_CLOSED_FOR_PAYMENTS */
      readonly successorLoanId?: string;
    };

export type PreviewActionResult = PaymentActionResult<AllocationPreviewResponse>;
export type PaymentRecordResult = PaymentActionResult<PaymentResponse>;

/** Textos em pt-BR dos erros de pagamento (E11 D13); o resto usa o texto da API. */
const MESSAGES: Readonly<Record<string, string>> = {
  PAYMENT_EXCEEDS_BALANCE: "O valor é maior que o saldo devedor do contrato.",
  LOAN_CLOSED_FOR_PAYMENTS: "Este contrato está encerrado e não aceita pagamentos.",
  LOAN_NOT_ACTIVE: "O contrato não está ativo. Ative o contrato antes de confirmar o pagamento.",
  PAYMENT_NOT_PENDING: "Este pagamento não está mais aguardando conferência. Recarregue a página.",
  PAYMENT_NOT_CONFIRMED: "Este pagamento não está confirmado, então não pode ser estornado.",
  REVERSAL_BLOCKED_BY_SUCCESSOR:
    "O contrato foi renovado ou renegociado depois deste pagamento. Estorne o contrato novo antes.",
  VERSION_CONFLICT: "Este pagamento foi alterado por outra pessoa. Recarregue a página e tente de novo.",
};

/** Erro da API vira resultado da tela; códigos conhecidos ganham texto próprio. */
export function toPaymentActionError(error: unknown): Extract<PaymentActionResult, { ok: false }> {
  const result = toActionError(error);
  const own = result.code === null ? undefined : MESSAGES[result.code];
  const successor =
    error instanceof ApiProblem && error.successorLoanId !== null ? { successorLoanId: error.successorLoanId } : {};
  return { ...result, ...(own === undefined ? {} : { message: own }), ...successor };
}

/** Contrato que aceita registro de pagamento: rascunho, ativo e baixado (RN-R09, E11 D6). */
export function acceptsPayment(status: string): boolean {
  return status === "DRAFT" || status === "ACTIVE" || status === "WRITTEN_OFF";
}
