import { z } from "zod";
import {
  centsSchema,
  idSchema,
  instantSchema,
  isoDateSchema,
  loanNumberSchema,
  positiveCentsSchema,
} from "../../common";
import { loanStatusSchema } from "../lending/loan-views";
import { paymentMethodSchema } from "./create-payment";

/** Situação do pagamento (RFC-005 §5). */
export const paymentStatusSchema = z.enum(["PENDING_REVIEW", "CONFIRMED", "REVERSED"]);
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

/** Um pagamento nas listas (RFC-004 §3); número do contrato e nome da pessoa vêm dos módulos donos. */
export const paymentListItemSchema = z.strictObject({
  id: idSchema,
  loanId: idSchema,
  loanNumber: loanNumberSchema,
  personId: idSchema,
  personName: z.string().min(1),
  accountId: idSchema,
  paidAt: isoDateSchema,
  amountCents: positiveCentsSchema,
  method: paymentMethodSchema,
  status: paymentStatusSchema,
  isRecovery: z.boolean(),
  createdAt: instantSchema,
  confirmedAt: instantSchema.nullable(),
  reversedAt: instantSchema.nullable(),
});
export type PaymentListItem = z.infer<typeof paymentListItemSchema>;

/** Quanto do pagamento confirmado foi para cada componente de uma parcela; vazio fora de CONFIRMED. */
export const paymentAllocationSchema = z.strictObject({
  installmentNumber: z.int().positive(),
  lateChargesCents: centsSchema,
  interestCents: centsSchema,
  principalCents: centsSchema,
});
export type PaymentAllocation = z.infer<typeof paymentAllocationSchema>;

/** Resposta de POST /payments (201): o item mais a versão, o motivo do estorno, o status do contrato e as alocações. */
export const paymentResponse = paymentListItemSchema.extend({
  version: z.int().positive(),
  reversalReason: z.string().nullable(),
  loanStatus: loanStatusSchema,
  allocations: z.array(paymentAllocationSchema),
});
export type PaymentResponse = z.infer<typeof paymentResponse>;

/** GET /payments: filtros e paginação por cursor. `limit` vem como texto na URL: padrão 20, de 1 a 100. */
export const paymentListQuery = z.strictObject({
  status: paymentStatusSchema.optional(),
  loanId: idSchema.optional(),
  limit: z
    .string()
    .max(3)
    .refine((text) => text !== "" && Array.from(text).every((char) => "0123456789".includes(char)))
    .transform((text) => Number(text))
    .pipe(z.int().min(1).max(100))
    .default(20),
  cursor: z.string().min(1).max(100).optional(),
});
export type PaymentListQuery = z.infer<typeof paymentListQuery>;

/** Resposta 200 de GET /payments (RFC-004): página com cursor. */
export const paymentListResponse = z.strictObject({
  items: z.array(paymentListItemSchema),
  nextCursor: z.string().nullable(),
});
export type PaymentListResponse = z.infer<typeof paymentListResponse>;
