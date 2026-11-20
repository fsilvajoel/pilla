import { z } from "zod";
import { idSchema, isoDateSchema } from "../common";
import { eventV1 } from "./envelope";

export const loanPaidOffPayload = z.strictObject({
  loanId: idSchema,
  personId: idSchema,
  paidOffAt: isoDateSchema,
});

/** RFC-004 §7: produtor lending; consumidores treasury. */
export const loanPaidOffV1 = eventV1("LoanPaidOff", loanPaidOffPayload);
export type LoanPaidOffV1 = z.infer<typeof loanPaidOffV1>;
