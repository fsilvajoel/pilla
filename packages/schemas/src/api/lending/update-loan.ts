import { z } from "zod";
import { bpsSchema, isoDateSchema, positiveCentsSchema } from "../../common";
import { frequencySchema, loanTypeSchema } from "./simulate-loan";

/**
 * PATCH /loans/{id} (RFC-004, RF-11): parcial dos campos de criação, sem `personId`; só vale em DRAFT.
 * A versão vem no cabeçalho `If-Match` (E10 D9), não no corpo.
 */
export const updateLoanRequest = z
  .strictObject({
    type: loanTypeSchema.optional(),
    principalCents: positiveCentsSchema.optional(),
    monthlyInterestRateBps: bpsSchema.optional(),
    installmentCount: z.int().positive().optional(),
    frequency: frequencySchema.optional(),
    firstDueDate: isoDateSchema.optional(),
    lateFeeBps: bpsSchema.optional(),
    lateInterestMonthlyBps: bpsSchema.optional(),
    gracePeriodDays: z.int().nonnegative().optional(),
    internalNotes: z.string().trim().min(1).max(2000).optional(),
  })
  .refine((r) => r.type !== "SINGLE_PAYMENT" || r.installmentCount === undefined || r.installmentCount === 1, {
    message: "SINGLE_PAYMENT has exactly one installment",
    path: ["installmentCount"],
  });
export type UpdateLoanRequest = z.infer<typeof updateLoanRequest>;
