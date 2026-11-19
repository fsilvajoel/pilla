// @stub E7-T12
import type { PaymentFields, PaymentMethod } from "@pilla/schemas";

/** Campos do pagamento como o ADMIN digita (RF-20). */
export interface PaymentFormValues {
  /** chave Pix / conta de destino, texto livre */
  readonly destinationKey: string;
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
export function toPaymentDraft(_loanId: string, _values: PaymentFormValues): PaymentFields {
  throw new Error("not implemented");
}
