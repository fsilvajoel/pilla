import { z } from "zod";
import { idSchema } from "../common";
import { eventV1 } from "./envelope";

export const loanRenewedPayload = z.strictObject({
  loanId: idSchema,
  successorLoanId: idSchema,
});

/** RFC-004 §7: produtor lending; consumidores treasury. */
export const loanRenewedV1 = eventV1("LoanRenewed", loanRenewedPayload);
export type LoanRenewedV1 = z.infer<typeof loanRenewedV1>;
