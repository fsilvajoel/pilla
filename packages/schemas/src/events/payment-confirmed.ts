// MÓDULO-MODELO (E2-T01, Claude). Os outros eventos seguem esta forma, um arquivo por evento.
import { z } from "zod";
import { centsSchema, idSchema, isoDateSchema, positiveCentsSchema } from "../common";
import { eventV1 } from "./envelope";

/** Quanto de um pagamento foi para cada componente de uma parcela (RN-T03). Reusado por PaymentReversed. */
export const allocationSchema = z.strictObject({
  installmentId: idSchema,
  lateChargesCents: centsSchema,
  interestCents: centsSchema,
  principalCents: centsSchema,
});

export type Allocation = z.infer<typeof allocationSchema>;
export function allocationsTotal(allocations: readonly Allocation[]): number {
  return allocations.reduce((sum, a) => sum + a.lateChargesCents + a.interestCents + a.principalCents, 0);
}

export const paymentConfirmedPayload = z
  .strictObject({
    paymentId: idSchema,
    loanId: idSchema,
    personId: idSchema,
    accountId: idSchema,
    paidAt: isoDateSchema,
    amountCents: positiveCentsSchema,
    allocations: z.array(allocationSchema).min(1),
    isRecovery: z.boolean(),
  })
  .refine((p) => allocationsTotal(p.allocations) === p.amountCents, {
    message: "allocations must sum to amountCents",
    path: ["allocations"],
  });

/** RFC-004 §7: produtor payments; consumidores lending (quitação) e treasury (REPAYMENT por componente). */
export const paymentConfirmedV1 = eventV1("PaymentConfirmed", paymentConfirmedPayload);
export type PaymentConfirmedV1 = z.infer<typeof paymentConfirmedV1>;
