import { z } from "zod";
import { idSchema, isoDateSchema, positiveCentsSchema } from "../../common";

/** POST /payments/allocation-preview (RFC-004). */
export const allocationPreviewRequest = z.strictObject({
  loanId: idSchema,
  amountCents: positiveCentsSchema,
  paidAt: isoDateSchema,
});
export type AllocationPreviewRequest = z.infer<typeof allocationPreviewRequest>;
