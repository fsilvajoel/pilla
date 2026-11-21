import { z } from "zod";
import {
  centsSchema,
  idSchema,
  instantSchema,
  isoDateSchema,
  loanNumberSchema,
  positiveCentsSchema,
} from "../../common";
import { paymentMethodSchema } from "../payments/create-payment";
import { loanStatusSchema } from "./loan-views";

const installmentIdentity = {
  loanId: idSchema,
  loanNumber: loanNumberSchema,
  personId: idSchema,
  personName: z.string().min(1),
  installmentNumber: z.int().positive(),
  dueDate: isoDateSchema,
  /** Principal e juros da parcela ainda não alocados. */
  openCents: centsSchema,
};

/** Parcela que vence hoje ou na semana (RF-50). */
export const dueInstallmentItemSchema = z.strictObject({
  ...installmentIdentity,
  status: z.enum(["OPEN", "PARTIAL"]),
});
export type DueInstallmentItem = z.infer<typeof dueInstallmentItemSchema>;

/** Parcela atrasada (RF-50): dias, encargos de mora sobre o saldo em aberto e total a pagar hoje. */
export const overdueInstallmentItemSchema = z.strictObject({
  ...installmentIdentity,
  daysOverdue: z.int().min(1),
  lateChargesCents: centsSchema,
  totalDueCents: centsSchema,
  status: z.enum(["OVERDUE", "OVERDUE_PARTIAL"]),
});
export type OverdueInstallmentItem = z.infer<typeof overdueInstallmentItemSchema>;

/** Pagamento aguardando conferência (preenchido na E13-F02B). */
export const pendingReviewItemSchema = z.strictObject({
  paymentId: idSchema,
  loanId: idSchema,
  loanNumber: loanNumberSchema,
  personName: z.string().min(1),
  loanStatus: loanStatusSchema,
  amountCents: positiveCentsSchema,
  paidAt: isoDateSchema,
  method: paymentMethodSchema,
  createdAt: instantSchema,
});
export type PendingReviewItem = z.infer<typeof pendingReviewItemSchema>;

function block<T extends z.ZodType>(item: T) {
  return z.strictObject({ count: z.int().nonnegative(), totalCents: centsSchema, items: z.array(item) });
}

/** Resposta 200 de GET /dashboard/today (RFC-004 §3, RF-50): tudo calculado na data de hoje em Brasília (ADR-0005). */
export const dashboardTodayResponse = z.strictObject({
  referenceDate: isoDateSchema,
  weekEndDate: isoDateSchema,
  dueToday: block(dueInstallmentItemSchema),
  dueThisWeek: block(dueInstallmentItemSchema),
  overdue: block(overdueInstallmentItemSchema),
  pendingReview: block(pendingReviewItemSchema),
});
export type DashboardTodayResponse = z.infer<typeof dashboardTodayResponse>;
