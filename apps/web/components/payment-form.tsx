"use client";
// @stub E7-T14

import type { LoanDetailResponse, PaymentFields } from "@pilla/schemas";
import type { JSX } from "react";

export interface PaymentFormProps {
  /** contrato do pagamento (dados de mentira) */
  readonly loan: LoanDetailResponse;
  /** recebe o pagamento pronto; sem API ainda */
  readonly onSubmit?: (payment: PaymentFields) => void;
}

/**
 * Registrar pagamento do ADMIN (PRD-001 RF-20). Título (h1) "Registrar pagamento", "Contrato " + `loanNumber` e
 * "Saldo devedor R$ " + `formatReais(outstandingCents)`. Contrato fechado (PAID_OFF, RENEWED, RENEGOTIATED,
 * CANCELLED) bloqueia a tela com "Este contrato não aceita pagamento."; DRAFT aceita. Formulário React Hook Form
 * com `PaymentFormValues` de `@/lib/payment-draft`: "Chave Pix de destino" (input de texto), "Data do pagamento"
 * (input type="date"), "Valor" e "Método" (select com PIX, BOLETO, CASH, BANK_TRANSFER e o texto de
 * `paymentMethodLabel` de `@/lib/labels`; começa em PIX). Sem comprovante. O botão "Registrar pagamento" chama
 * `toPaymentDraft(loan.id, campos)`, depois `onSubmit` e mostra "Pagamento registrado para conferência." num
 * elemento role="status". Erro: "Confira os campos do pagamento." num elemento role="alert", sem chamar `onSubmit`.
 */
export function PaymentForm({ loan: _loan, onSubmit: _onSubmit }: PaymentFormProps): JSX.Element {
  throw new Error("not implemented");
}
