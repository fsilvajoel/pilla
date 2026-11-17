// @stub E7-T12
import type { AttachmentUploadUrlRequest, PaymentFields, PaymentMethod } from "@pilla/schemas";

/** Campos do pagamento como o ADMIN digita (RF-20). */
export interface PaymentFormValues {
  /** id da conta de destino, ou "" enquanto nada foi escolhido */
  readonly accountId: string;
  /** data do pagamento "AAAA-MM-DD" (input type="date") */
  readonly paidAt: string;
  /** valor em reais, ex.: "1.150,00" */
  readonly amount: string;
  readonly method: PaymentMethod;
}

/** O que a tela precisa do arquivo do comprovante; um `File` do input serve. */
export type ReceiptFile = Pick<File, "name" | "size" | "type">;

/** Pagamento pronto para enviar: os campos e o pedido de upload do comprovante (null sem comprovante). */
export interface PaymentDraft {
  readonly payment: PaymentFields;
  readonly receipt: AttachmentUploadUrlRequest | null;
}

/** Comprovante faltando num método que exige (RN-R06); `code` é o da RFC-004 §6. */
export class ReceiptRequiredError extends Error {
  readonly code = "RECEIPT_REQUIRED";

  constructor() {
    super("comprovante obrigatório exceto em espécie (RN-R06)");
    this.name = "ReceiptRequiredError";
  }
}

/**
 * Monta o pagamento do contrato `loanId` (RF-20, decisões do Joel de 17/11). Sem `receipt` e com método diferente
 * de CASH, lança `ReceiptRequiredError` (RN-R06). `amount` passa por `parseReais` de `@pilla/finance` ("1.150,00"
 * vira 115000) e os campos por `paymentFieldsSchema.parse`; o comprovante vira `{fileName, contentType,
 * sizeBytes}` (name, type, size do arquivo) e passa por `attachmentUploadUrlRequest.parse` (PDF e imagens até
 * 10 MiB). Texto fora do formato lança MoneyError ou ZodError, sem tratamento.
 */
export function toPaymentDraft(
  _loanId: string,
  _values: PaymentFormValues,
  _receipt: ReceiptFile | null,
): PaymentDraft {
  throw new Error("not implemented");
}
