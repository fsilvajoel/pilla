import { z } from "zod";
import {
  idSchema,
  instantSchema,
  isoDateSchema,
  positiveCentsSchema,
  reasonSchema,
  signedCentsSchema,
} from "../../common";

/**
 * POST /accounts/{id}/entries (RFC-004, RF-30). Decisão do Joel (2026-11-15): aporte e retirada chegam
 * sempre positivos, o sinal vem do tipo; o ajuste tem sinal próprio (nunca zero) e exige justificativa (RFC-005).
 */
export const accountEntryRequest = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.enum(["CAPITAL_IN", "CAPITAL_OUT"]),
    amountCents: positiveCentsSchema,
    entryDate: isoDateSchema,
    justification: reasonSchema.optional(),
  }),
  z.strictObject({
    type: z.literal("ADJUSTMENT"),
    amountCents: signedCentsSchema,
    entryDate: isoDateSchema,
    justification: reasonSchema,
  }),
]);
export type AccountEntryRequest = z.infer<typeof accountEntryRequest>;

/** Os seis tipos do livro-caixa (RFC-005 §6). */
export const ledgerEntryTypeSchema = z.enum([
  "CAPITAL_IN",
  "CAPITAL_OUT",
  "DISBURSEMENT",
  "REPAYMENT",
  "REVERSAL",
  "ADJUSTMENT",
]);
export const ledgerComponentSchema = z.enum(["PRINCIPAL", "INTEREST", "LATE_CHARGES", "RECOVERY"]);
export const ledgerSourceTypeSchema = z.enum(["LOAN", "PAYMENT"]);

/** Resposta 201 de POST /accounts/{id}/entries: o lançamento como gravado, com `amountCents` com sinal. */
export const accountEntryResponse = z.strictObject({
  id: idSchema,
  accountId: idSchema,
  type: ledgerEntryTypeSchema,
  component: ledgerComponentSchema.nullable(),
  amountCents: signedCentsSchema,
  entryDate: isoDateSchema,
  justification: z.string().nullable(),
  sourceType: ledgerSourceTypeSchema.nullable(),
  sourceId: idSchema.nullable(),
  createdAt: instantSchema,
});
export type AccountEntryResponse = z.infer<typeof accountEntryResponse>;
