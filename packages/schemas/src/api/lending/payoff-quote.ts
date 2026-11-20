import { z } from "zod";
import { centsSchema, isoDateSchema } from "../../common";

/** GET /loans/{id}/payoff-quote?date= (RFC-004). */
export const payoffQuoteQuery = z.strictObject({
  date: isoDateSchema,
});

export type PayoffQuoteQuery = z.infer<typeof payoffQuoteQuery>;

/**
 * Resposta 200 de GET /loans/{id}/payoff-quote (RF-18, RN-C08): quitação sem desconto na data pedida.
 * `amountCents` é a soma dos três componentes: principal e juros em aberto mais os encargos na data (ADR-0005).
 */
export const payoffQuoteResponse = z.strictObject({
  date: isoDateSchema,
  amountCents: centsSchema,
  principalCents: centsSchema,
  interestCents: centsSchema,
  lateChargesCents: centsSchema,
});

export type PayoffQuoteResponse = z.infer<typeof payoffQuoteResponse>;
