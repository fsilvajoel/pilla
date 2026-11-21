import { z } from "zod";
import { idSchema, isoDateSchema, positiveCentsSchema } from "../../common";

/** Glossário: PIX · BOLETO (Boleto) · CASH (Espécie) · BANK_TRANSFER (Transferência). */
export const paymentMethodSchema = z.enum(["PIX", "BOLETO", "CASH", "BANK_TRANSFER"]);
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

/**
 * Campos do pagamento (RF-20, E11 D2): a conta de destino é `accountId`, de `GET /accounts`. Sem comprovante
 * (v1.1); a web monta o pagamento com este mesmo esquema.
 */
export const paymentFieldsSchema = z.strictObject({
  loanId: idSchema,
  accountId: idSchema,
  paidAt: isoDateSchema,
  amountCents: positiveCentsSchema,
  method: paymentMethodSchema,
});
export type PaymentFields = z.infer<typeof paymentFieldsSchema>;

/** POST /payments (RFC-004, RF-20): registra em PENDING_REVIEW; o corpo é só os cinco campos. */
export const createPaymentRequest = paymentFieldsSchema;
export type CreatePaymentRequest = z.infer<typeof createPaymentRequest>;
