import { z } from "zod";
import { bpsSchema, centsSchema, idSchema, isoDateSchema, loanNumberSchema, positiveCentsSchema } from "../../common";
import { frequencySchema, loanTypeSchema } from "./simulate-loan";

/** Glossário: status do contrato (RFC-005 `loans.status`). */
export const loanStatusSchema = z.enum([
  "DRAFT",
  "ACTIVE",
  "PAID_OFF",
  "RENEWED",
  "RENEGOTIATED",
  "WRITTEN_OFF",
  "CANCELLED",
]);
export type LoanStatus = z.infer<typeof loanStatusSchema>;
/** Glossário: situação calculada de um contrato ACTIVE (em dia / em atraso). */
export const loanStandingSchema = z.enum(["CURRENT", "OVERDUE"]);
export type LoanStanding = z.infer<typeof loanStandingSchema>;
/** Glossário: situação calculada da parcela. */
export const installmentStatusSchema = z.enum(["OPEN", "PARTIAL", "PAID", "OVERDUE", "OVERDUE_PARTIAL"]);
export type InstallmentStatus = z.infer<typeof installmentStatusSchema>;

/** Linha da lista de contratos (decisões do Joel de 17/11); `standing` e `nextDueDate` nulos fora de ACTIVE. */
export const loanListItemSchema = z.strictObject({
  id: idSchema,
  loanNumber: loanNumberSchema,
  personName: z.string().min(1),
  principalCents: positiveCentsSchema,
  outstandingCents: centsSchema,
  status: loanStatusSchema,
  standing: loanStandingSchema.nullable(),
  nextDueDate: isoDateSchema.nullable(),
});
export type LoanListItem = z.infer<typeof loanListItemSchema>;

/** Resposta 200 de GET /loans (RFC-004): página com cursor. */
export const loanListResponse = z.strictObject({
  items: z.array(loanListItemSchema),
  nextCursor: z.string().nullable(),
});
export type LoanListResponse = z.infer<typeof loanListResponse>;

/** Parcela no detalhe (RF-18): valor, quanto já foi pago, encargos calculados e situação. */
export const loanInstallmentSchema = z.strictObject({
  number: z.int().positive(),
  dueDate: isoDateSchema,
  totalCents: centsSchema,
  paidCents: centsSchema,
  lateChargesCents: centsSchema,
  status: installmentStatusSchema,
});
export type LoanInstallment = z.infer<typeof loanInstallmentSchema>;

/**
 * Resposta 200 de GET /loans/{id} (RFC-004, RF-18): condições copiadas (ADR-0008) e calculados (ADR-0005).
 * `interestCents` é a soma dos juros das parcelas (decisões do Joel de 17/11).
 */
export const loanDetailResponse = z.strictObject({
  id: idSchema,
  loanNumber: loanNumberSchema,
  personId: idSchema,
  personName: z.string().min(1),
  type: loanTypeSchema,
  status: loanStatusSchema,
  version: z.int().positive(),
  standing: loanStandingSchema.nullable(),
  principalCents: positiveCentsSchema,
  monthlyInterestRateBps: bpsSchema,
  installmentCount: z.int().positive(),
  frequency: frequencySchema,
  firstDueDate: isoDateSchema,
  contractedAt: isoDateSchema,
  disbursedAt: isoDateSchema.nullable(),
  lateFeeBps: bpsSchema,
  lateInterestMonthlyBps: bpsSchema,
  gracePeriodDays: z.int().nonnegative(),
  roundingStepCents: positiveCentsSchema,
  totalCents: centsSchema,
  interestCents: centsSchema,
  paidCents: centsSchema,
  outstandingCents: centsSchema,
  installments: z.array(loanInstallmentSchema),
});
export type LoanDetailResponse = z.infer<typeof loanDetailResponse>;
