import { z } from "zod";
import { centsSchema, idSchema, isoDateSchema, loanNumberSchema } from "../../common";
import { installmentStatusSchema } from "../lending/loan-views";
import { paymentMethodSchema } from "../payments/create-payment";

/** Situação do contrato para o cliente (E15 D2, D9). */
export const portalSituationSchema = z.enum(["CURRENT", "OVERDUE", "PAID_OFF"]);
export type PortalSituation = z.infer<typeof portalSituationSchema>;

/** Forma de pagamento mostrada ao cliente; os rótulos em português vivem na tela. */
export const portalPaymentMethodSchema = paymentMethodSchema;
export type PortalPaymentMethod = z.infer<typeof portalPaymentMethodSchema>;

/** Status da parcela mostrado ao cliente: o mesmo enum do ADMIN. */
export const portalInstallmentStatusSchema = installmentStatusSchema;
export type PortalInstallmentStatus = z.infer<typeof portalInstallmentStatusSchema>;

/** Item de GET /portal/loans (RF-61). Nenhum campo de pessoa nem dado interno (RF-63). */
export const portalLoanListItem = z.strictObject({
  id: idSchema,
  loanNumber: loanNumberSchema,
  principalCents: centsSchema,
  outstandingCents: centsSchema,
  situation: portalSituationSchema,
  nextDueDate: isoDateSchema.nullable(),
});
export type PortalLoanListItem = z.infer<typeof portalLoanListItem>;

/** GET /portal/loans: sem paginação (E15 D8). */
export const portalLoanListResponse = z.strictObject({
  items: z.array(portalLoanListItem),
});
export type PortalLoanListResponse = z.infer<typeof portalLoanListResponse>;

export const portalNextInstallment = z.strictObject({
  number: z.int().positive(),
  dueDate: isoDateSchema,
  amountCents: centsSchema,
});

export const portalInstallment = z.strictObject({
  number: z.int().positive(),
  dueDate: isoDateSchema,
  amountCents: centsSchema,
  paidCents: centsSchema,
  lateChargesCents: centsSchema,
  status: portalInstallmentStatusSchema,
});

export const portalPayment = z.strictObject({
  paidAt: isoDateSchema,
  amountCents: centsSchema,
  method: portalPaymentMethodSchema,
});

/** GET /portal/loans/{id} (RF-62, RFC-004 §5). */
export const portalLoanDetailResponse = z.strictObject({
  id: idSchema,
  loanNumber: loanNumberSchema,
  situation: portalSituationSchema,
  principalCents: centsSchema,
  totalCents: centsSchema,
  paidCents: centsSchema,
  outstandingCents: centsSchema,
  lateChargesCents: centsSchema,
  nextInstallment: portalNextInstallment.nullable(),
  installments: z.array(portalInstallment),
  payments: z.array(portalPayment),
});
export type PortalLoanDetailResponse = z.infer<typeof portalLoanDetailResponse>;
