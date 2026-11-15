import { z } from "zod";
import { centsSchema, idSchema, reasonSchema } from "../common";
import { eventV1 } from "./envelope";

export const loanWrittenOffPayload = z.strictObject({
  loanId: idSchema,
  outstandingPrincipalCents: centsSchema,
  reason: reasonSchema,
});

/** RFC-004 §7: produtor lending; consumidores treasury (perdas). */
export const loanWrittenOffV1 = eventV1("LoanWrittenOff", loanWrittenOffPayload);
export type LoanWrittenOffV1 = z.infer<typeof loanWrittenOffV1>;
