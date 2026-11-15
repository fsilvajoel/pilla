import { z } from "zod";

/** GET /loans/{id}/payoff-quote?date= (RFC-004). ESBOÇO: a Alice troca o z.never() pelo corpo, como em lending/simulate-loan.ts. */
export const payoffQuoteQuery = z.never();
