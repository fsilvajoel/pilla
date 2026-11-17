"use client";
// @stub E7-T14

import type { AccountSummary, LoanDetailResponse } from "@pilla/schemas";
import type { JSX } from "react";
import type { PaymentDraft } from "@/lib/payment-draft";

export interface PaymentFormProps {
  /** contrato do pagamento (dados de mentira, decisões do Joel de 17/11) */
  readonly loan: LoanDetailResponse;
  /** opções da "Conta de destino" */
  readonly accounts: readonly AccountSummary[];
  /** recebe o pagamento pronto; sem API ainda (o envio do comprovante depende do Joel) */
  readonly onSubmit?: (draft: PaymentDraft) => void;
}

/**
 * Registrar pagamento do ADMIN (PRD-001 RF-20, RN-R06). Título (h1) "Registrar pagamento", o texto "Contrato " +
 * `loanNumber` e "Saldo devedor R$ " + `formatReais(outstandingCents)`. Formulário React Hook Form com
 * `PaymentFormValues` de `@/lib/payment-draft`, cada campo com rótulo: "Conta de destino" (select com a opção
 * value "" e texto "Selecione", depois uma opção por conta, value = id e texto = name), "Data do pagamento" (input
 * type="date"), "Valor", "Método" (select com value PIX, BOLETO, CASH, BANK_TRANSFER e o texto de
 * `paymentMethodLabel` de `@/lib/labels`; começa em PIX) e "Comprovante" (input type="file" fora do React Hook
 * Form, o arquivo escolhido fica num useState). O botão "Registrar pagamento" chama `toPaymentDraft(loan.id,
 * campos, arquivo ou null)`, depois `onSubmit` com o resultado, e mostra "Pagamento registrado para
 * conferência." num elemento role="status". Erro: `ReceiptRequiredError` mostra "Anexe o comprovante (obrigatório
 * exceto em espécie)." e qualquer outro "Confira os campos do pagamento.", num elemento role="alert", sem chamar
 * `onSubmit`.
 */
export function PaymentForm({ loan: _loan, accounts: _accounts, onSubmit: _onSubmit }: PaymentFormProps): JSX.Element {
  throw new Error("not implemented");
}
