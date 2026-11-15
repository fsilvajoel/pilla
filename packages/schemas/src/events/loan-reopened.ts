import { z } from "zod";
import { idSchema, reasonSchema } from "../common";
import { eventV1 } from "./envelope";

export const loanReopenedPayload = z.strictObject({
  loanId: idSchema,
  reason: reasonSchema,
});

/** RFC-004 §7: produtor lending; consumidores treasury. */
export const loanReopenedV1 = eventV1("LoanReopened", loanReopenedPayload);
export type LoanReopenedV1 = z.infer<typeof loanReopenedV1>;
