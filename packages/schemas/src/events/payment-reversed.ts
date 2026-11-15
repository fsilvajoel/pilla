import { z } from "zod";
import { eventV1 } from "./envelope";
import { idSchema, positiveCentsSchema, reasonSchema } from "../common";
import { allocationSchema } from "./payment-confirmed";

export const paymentReversedPayload = z
  .strictObject({
    paymentId: idSchema,
    loanId: idSchema,
    accountId: idSchema,
    amountCents: positiveCentsSchema,
    allocations: z.array(allocationSchema).min(1),
    reason: reasonSchema,
  })
  .refine(
    (p) =>
      p.allocations.reduce((sum, a) => sum + a.lateChargesCents + a.interestCents + a.principalCents, 0) ===
      p.amountCents,
    {
      message: "allocations must sum to amountCents",
      path: ["allocations"],
    },
  );

/** RFC-004 §7: produtor payments; consumidores lending (reabertura), treasury (REVERSAL). */
export const paymentReversedV1 = eventV1("PaymentReversed", paymentReversedPayload);
export type PaymentReversedV1 = z.infer<typeof paymentReversedV1>;
