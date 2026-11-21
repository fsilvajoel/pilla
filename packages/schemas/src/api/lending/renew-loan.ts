import { z } from "zod";
import { bpsSchema, isoDateSchema } from "../../common";
import { frequencySchema } from "./simulate-loan";

/**
 * POST /loans/{id}/renew (RFC-004 §3, RF-13): cria o DRAFT de renovação. `firstDueDate` é obrigatório; taxa, prazo e
 * periodicidade só entram para ajustar o que o contrato de origem já traz (RN-C15).
 */
export const renewLoanRequest = z.strictObject({
  firstDueDate: isoDateSchema,
  monthlyInterestRateBps: bpsSchema.optional(),
  installmentCount: z.int().positive().optional(),
  frequency: frequencySchema.optional(),
});
export type RenewLoanRequest = z.infer<typeof renewLoanRequest>;
