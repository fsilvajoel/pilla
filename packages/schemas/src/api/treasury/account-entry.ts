import { z } from "zod";
import { isoDateSchema, positiveCentsSchema, reasonSchema, signedCentsSchema } from "../../common";

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
