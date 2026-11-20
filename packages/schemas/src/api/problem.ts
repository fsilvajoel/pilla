// Erros da API em application/problem+json (RFC 9457), com `code` estável (RFC-004 §6).
import { z } from "zod";
import { idSchema } from "../common";

/** `code` estável (RFC-004 §6). O texto em pt-BR de cada code fica no arquivo de mensagens. */
export const errorCodeSchema = z.enum([
  "VALIDATION_FAILED",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "VERSION_CONFLICT",
  "DUPLICATE_CPF",
  "LOAN_NOT_EDITABLE",
  "INSUFFICIENT_ACCOUNT_BALANCE",
  "FIRST_DUE_DATE_BEFORE_DISBURSEMENT",
  "PAYMENT_EXCEEDS_BALANCE",
  "LOAN_CLOSED_FOR_PAYMENTS",
  "RENEWAL_REQUIRES_INTEREST_PAID",
  "REVERSAL_BLOCKED_BY_SUCCESSOR",
  "RECEIPT_REQUIRED",
  "DUPLICATE_PIX_TRANSACTION",
  "TOO_MANY_REQUESTS",
]);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

/** `code` → status HTTP (RFC-004 §6). */
export const errorStatus: Record<ErrorCode, number> = {
  VALIDATION_FAILED: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VERSION_CONFLICT: 409,
  DUPLICATE_CPF: 409,
  LOAN_NOT_EDITABLE: 422,
  INSUFFICIENT_ACCOUNT_BALANCE: 422,
  FIRST_DUE_DATE_BEFORE_DISBURSEMENT: 422,
  PAYMENT_EXCEEDS_BALANCE: 422,
  LOAN_CLOSED_FOR_PAYMENTS: 422,
  RENEWAL_REQUIRES_INTEREST_PAID: 422,
  REVERSAL_BLOCKED_BY_SUCCESSOR: 422,
  RECEIPT_REQUIRED: 422,
  DUPLICATE_PIX_TRANSACTION: 422,
  TOO_MANY_REQUESTS: 429,
};

export const problemSchema = z
  .strictObject({
    type: z.string().min(1).optional(),
    title: z.string().min(1),
    status: z.int().min(400).max(599),
    detail: z.string().min(1),
    instance: z.string().min(1).optional(),
    code: errorCodeSchema,
    /** só em VALIDATION_FAILED: um item por campo recusado */
    errors: z
      .array(z.strictObject({ field: z.string().min(1), message: z.string().min(1) }))
      .min(1)
      .optional(),
    /** só em LOAN_CLOSED_FOR_PAYMENTS (RN-R09) */
    successorLoanId: idSchema.optional(),
  })
  .refine((p) => p.status === errorStatus[p.code], { message: "status must match the code", path: ["status"] });
export type Problem = z.infer<typeof problemSchema>;
