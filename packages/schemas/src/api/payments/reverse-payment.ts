import { z } from "zod";
import { reasonSchema } from "../../common";

/** POST /payments/{id}/reverse (RFC-004). */
export const reversePaymentRequest = z.strictObject({
  reason: reasonSchema,
});
export type ReversePaymentRequest = z.infer<typeof reversePaymentRequest>;
