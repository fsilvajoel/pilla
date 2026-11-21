import { z } from "zod";
import { centsSchema, idSchema, isoDateSchema, positiveCentsSchema } from "../../common";
import { loanStatusSchema } from "../lending/loan-views";

/** POST /payments/allocation-preview (RFC-004). */
export const allocationPreviewRequest = z.strictObject({
  loanId: idSchema,
  amountCents: positiveCentsSchema,
  paidAt: isoDateSchema,
});
export type AllocationPreviewRequest = z.infer<typeof allocationPreviewRequest>;

/** Quanto do pagamento vai para cada componente de uma parcela (RN-R02). */
export const previewAllocationSchema = z.strictObject({
  installmentNumber: z.int().positive(),
  dueDate: isoDateSchema,
  lateChargesCents: centsSchema,
  interestCents: centsSchema,
  principalCents: centsSchema,
  /** situação da parcela depois desta alocação (RN-R04) */
  installmentStatusAfter: z.enum(["PAID", "PARTIAL"]),
});
export type PreviewAllocation = z.infer<typeof previewAllocationSchema>;

export const previewTotalsSchema = z.strictObject({
  lateChargesCents: centsSchema,
  interestCents: centsSchema,
  principalCents: centsSchema,
});

/**
 * Resposta 200 de POST /payments/allocation-preview (RF-23). Só inteiros; fora de `deferred`, as alocações e os
 * totais somam `amountCents`. Em DRAFT (`deferred`) não há cronograma: alocações vazias, totais zerados e saldos nulos.
 */
export const allocationPreviewResponse = z
  .strictObject({
    loanId: idSchema,
    loanStatus: loanStatusSchema,
    paidAt: isoDateSchema,
    amountCents: positiveCentsSchema,
    deferred: z.boolean(),
    isRecovery: z.boolean(),
    allocations: z.array(previewAllocationSchema),
    totals: previewTotalsSchema,
    outstandingBeforeCents: centsSchema.nullable(),
    outstandingAfterCents: centsSchema.nullable(),
    paysOff: z.boolean(),
  })
  .superRefine((preview, ctx) => {
    if (preview.deferred) return;
    const sum = (pick: (a: { lateChargesCents: number; interestCents: number; principalCents: number }) => number) =>
      preview.allocations.reduce((total, allocation) => total + pick(allocation), 0);
    const totals = preview.totals;
    if (totals.lateChargesCents + totals.interestCents + totals.principalCents !== preview.amountCents) {
      ctx.addIssue({ code: "custom", path: ["totals"], message: "totals must add up to amountCents" });
    }
    if (
      sum((a) => a.lateChargesCents) !== totals.lateChargesCents ||
      sum((a) => a.interestCents) !== totals.interestCents ||
      sum((a) => a.principalCents) !== totals.principalCents
    ) {
      ctx.addIssue({ code: "custom", path: ["allocations"], message: "allocations must add up to the totals" });
    }
  });
export type AllocationPreviewResponse = z.infer<typeof allocationPreviewResponse>;
