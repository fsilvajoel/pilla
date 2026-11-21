import { z } from "zod";
import type { PaymentMethod } from "./create-payment";

/** Esboço (E11-T03): o contrato da E13 (docs/plano/E11-F02/plano.md) entra na E11-T04. */
export type PendingPayment = {
  id: string;
  loanId: string;
  personId: string;
  accountId: string;
  paidAt: string;
  amountCents: number;
  method: PaymentMethod;
  registeredAt: string;
};
export const pendingPaymentSchema: z.ZodType<PendingPayment> = z.never();
export type PendingPaymentsSummary = { count: number; totalCents: number; items: PendingPayment[] };
export const pendingPaymentsSummarySchema: z.ZodType<PendingPaymentsSummary> = z.never();
