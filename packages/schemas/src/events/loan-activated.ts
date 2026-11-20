import { z } from "zod";
import { eventV1 } from "./envelope";
import { idSchema, centsSchema, isoDateSchema } from "../common";

export const loanActivatedPayload = z.strictObject({
  loanId: idSchema,
  personId: idSchema,
  accountId: idSchema,
  principalCents: centsSchema,
  disbursedAt: isoDateSchema,
  originLoanId: idSchema.optional(),
  originType: z.enum(["RENEWAL", "RENEGOTIATION", "IMPORT"]).optional(),
});

/** RFC-004 §7: produtor lending; consumidores treasury (DISBURSEMENT), lending (contrato de origem). */
export const loanActivatedV1 = eventV1("LoanActivated", loanActivatedPayload);
export type LoanActivatedV1 = z.infer<typeof loanActivatedV1>;
