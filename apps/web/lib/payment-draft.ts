import type { PaymentFields, PaymentMethod } from "@pilla/schemas";
import { parseReais } from "@pilla/finance";
import { paymentFieldsSchema } from "@pilla/schemas";

/** Campos do pagamento como o ADMIN digita (RF-20). */
export interface PaymentFormValues {
  /** id da conta de destino (`GET /accounts`); a tela ligada à API (E11-F05) troca o campo por uma lista de contas */
  readonly accountId: string;
  /** data do pagamento "AAAA-MM-DD" (input type="date") */
  readonly paidAt: string;
  /** valor em reais, ex.: "1.150,00" */
  readonly amount: string;
  readonly method: PaymentMethod;
}

/**
 * Monta o pagamento do contrato `loanId` (RF-20). `amount` passa por `parseReais` de `@pilla/finance` ("1.150,00"
 * vira 115000) e os campos por `paymentFieldsSchema.parse`. Texto fora do formato lança MoneyError ou ZodError,
 * sem tratamento.
 */
export function toPaymentDraft(loanId: string, values: PaymentFormValues): PaymentFields {
  return paymentFieldsSchema.parse({
    loanId,
    accountId: values.accountId,
    paidAt: values.paidAt,
    amountCents: Number(parseReais(values.amount)),
    method: values.method,
  });
}
