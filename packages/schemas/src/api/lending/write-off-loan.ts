import { z } from "zod";

/** POST /loans/{id}/write-off (RFC-004). ESBOÇO: a Alice troca o z.never() pelo corpo, como em lending/simulate-loan.ts. */
export const writeOffLoanRequest = z.never();
