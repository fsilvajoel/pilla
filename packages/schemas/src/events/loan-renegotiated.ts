import { z } from "zod";
import { eventV1 } from "./envelope";
import { centsSchema, idSchema } from "../common";

export const loanRenegotiatedPayload = z.strictObject({
  loanId: idSchema,
  successorLoanId: idSchema,
  capitalizedCents: centsSchema,
});

/** RFC-004 §7: produtor lending; consumidores treasury. */
export const loanRenegotiatedV1 = eventV1("LoanRenegotiated", loanRenegotiatedPayload);
export type LoanRenegotiatedV1 = z.infer<typeof loanRenegotiatedV1>;
