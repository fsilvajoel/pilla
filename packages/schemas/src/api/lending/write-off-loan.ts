import { z } from "zod";
import { reasonSchema } from "../../common";

/** POST /loans/{id}/write-off (RFC-004). */
export const writeOffLoanRequest = z.strictObject({
  reason: reasonSchema,
});

export type WriteOffLoanRequest = z.infer<typeof writeOffLoanRequest>;
