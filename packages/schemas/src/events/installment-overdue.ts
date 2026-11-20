import { z } from "zod";
import { centsSchema, idSchema, isoDateSchema } from "../common";
import { eventV1 } from "./envelope";

export const installmentOverduePayload = z.strictObject({
  installmentId: idSchema,
  loanId: idSchema,
  personId: idSchema,
  dueDate: isoDateSchema,
  outstandingCents: centsSchema,
});

/** RFC-004 §7: produtor lending (rotina diária); consumidores — (futuro: messaging, risk). */
export const installmentOverdueV1 = eventV1("InstallmentOverdue", installmentOverduePayload);
export type InstallmentOverdueV1 = z.infer<typeof installmentOverdueV1>;
