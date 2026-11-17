import { z } from "zod";
import { idSchema, isoDateSchema, positiveCentsSchema } from "../../common";

/** Glossário: PIX · BOLETO (Boleto) · CASH (Espécie) · BANK_TRANSFER (Transferência). */
export const paymentMethodSchema = z.enum(["PIX", "BOLETO", "CASH", "BANK_TRANSFER"]);
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

/** Campos do pagamento sem o anexo: o navegador sobe o comprovante antes (decisões do Joel de 17/11). */
export const paymentFieldsSchema = z.strictObject({
  loanId: idSchema,
  accountId: idSchema,
  paidAt: isoDateSchema,
  amountCents: positiveCentsSchema,
  method: paymentMethodSchema,
});
export type PaymentFields = z.infer<typeof paymentFieldsSchema>;

/** POST /payments (RFC-004, RF-20): registra em PENDING_REVIEW; comprovante obrigatório exceto em CASH (RN-R06). */
export const createPaymentRequest = paymentFieldsSchema
  .extend({ receiptAttachmentId: idSchema.optional() })
  .refine((p) => p.method === "CASH" || p.receiptAttachmentId !== undefined, {
    message: "RECEIPT_REQUIRED",
    path: ["receiptAttachmentId"],
  });
export type CreatePaymentRequest = z.infer<typeof createPaymentRequest>;
