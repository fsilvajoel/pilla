import { z } from "zod";
import { bpsSchema, isoDateSchema } from "../../common";
import { frequencySchema } from "./simulate-loan";

/**
 * POST /loans/{id}/renegotiate (RFC-004 §3, RF-14): cria o DRAFT de renegociação com o saldo capitalizado.
 * `firstDueDate` é obrigatório; taxa, prazo e periodicidade só ajustam as condições de origem (RN-C17).
 */
export const renegotiateLoanRequest = z.strictObject({
  firstDueDate: isoDateSchema,
  monthlyInterestRateBps: bpsSchema.optional(),
  installmentCount: z.int().positive().optional(),
  frequency: frequencySchema.optional(),
});
export type RenegotiateLoanRequest = z.infer<typeof renegotiateLoanRequest>;
