import { z } from "zod";
import { idSchema, isoDateSchema } from "../../common";

/** POST /loans/{id}/activate (RFC-004). */
export const activateLoanRequest = z.strictObject({
  disbursedAt: isoDateSchema,
  accountId: idSchema,
});
export type ActivateLoanRequest = z.infer<typeof activateLoanRequest>;
