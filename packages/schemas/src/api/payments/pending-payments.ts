import { z } from "zod";
import { centsSchema, idSchema, instantSchema, isoDateSchema, positiveCentsSchema } from "../../common";
import { paymentMethodSchema } from "./create-payment";

/** Pagamento aguardando conferência, só ids e valores (contrato da E13, RF-50; docs/plano/E11-F02/plano.md). */
export const pendingPaymentSchema = z.strictObject({
  id: idSchema,
  loanId: idSchema,
  personId: idSchema,
  accountId: idSchema,
  /** data do pagamento informada */
  paidAt: isoDateSchema,
  amountCents: positiveCentsSchema,
  method: paymentMethodSchema,
  /** `created_at`, instante com fuso */
  registeredAt: instantSchema,
});
export type PendingPayment = z.infer<typeof pendingPaymentSchema>;

/** Fila de pendentes: `count` e `totalCents` cobrem todos os PENDING_REVIEW, `items` só a página pedida. */
export const pendingPaymentsSummarySchema = z.strictObject({
  count: z.int().nonnegative(),
  totalCents: centsSchema,
  items: z.array(pendingPaymentSchema),
});
export type PendingPaymentsSummary = z.infer<typeof pendingPaymentsSummarySchema>;
