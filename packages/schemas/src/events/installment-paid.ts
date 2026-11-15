import { z } from "zod";
import { idSchema, isoDateSchema } from "../common";
import { eventV1 } from "./envelope";

export const installmentPaidPayload = z.strictObject({
  installmentId: idSchema,
  loanId: idSchema,
  paidAt: isoDateSchema,
  daysLate: z.number().int().min(0),
});

/** RFC-004 §7: produtor payments; consumidores — (futuro: risk). */
export const installmentPaidV1 = eventV1("InstallmentPaid", installmentPaidPayload);
export type InstallmentPaidV1 = z.infer<typeof installmentPaidV1>;
