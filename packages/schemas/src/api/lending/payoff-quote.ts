import { z } from "zod";
import { isoDateSchema } from "../../common";

/** GET /loans/{id}/payoff-quote?date= (RFC-004). */
export const payoffQuoteQuery = z.strictObject({
  date: isoDateSchema,
});

export type PayoffQuoteQuery = z.infer<typeof payoffQuoteQuery>;
