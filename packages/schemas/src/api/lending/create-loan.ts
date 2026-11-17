import { z } from "zod";
import { bpsSchema, idSchema, isoDateSchema, positiveCentsSchema } from "../../common";
import { frequencySchema, loanTypeSchema } from "./simulate-loan";

/** Resposta 200 de GET /settings/default-terms (RFC-004, RF-40; RFC-005 `default_terms`). */
export const defaultTermsResponse = z.strictObject({
  lateFeeBps: bpsSchema,
  lateInterestMonthlyBps: bpsSchema,
  gracePeriodDays: z.int().nonnegative(),
  suggestedMonthlyRateBps: bpsSchema,
  roundingStepCents: positiveCentsSchema,
});
export type DefaultTermsResponse = z.infer<typeof defaultTermsResponse>;

/**
 * POST /loans (RFC-004, RF-11): cria em DRAFT. Os encargos vêm preenchidos com o padrão e o ADMIN ajusta antes
 * da ativação (RF-41); o servidor copia o passo de arredondamento do padrão (RN-C12, ADR-0008).
 */
export const createLoanRequest = z
  .strictObject({
    personId: idSchema,
    type: loanTypeSchema,
    principalCents: positiveCentsSchema,
    monthlyInterestRateBps: bpsSchema,
    installmentCount: z.int().positive(),
    frequency: frequencySchema,
    firstDueDate: isoDateSchema,
    lateFeeBps: bpsSchema,
    lateInterestMonthlyBps: bpsSchema,
    gracePeriodDays: z.int().nonnegative(),
    internalNotes: z.string().trim().min(1).max(2000).optional(),
  })
  .refine((r) => r.type === "INSTALLMENT" || r.installmentCount === 1, {
    message: "SINGLE_PAYMENT has exactly one installment",
    path: ["installmentCount"],
  });
export type CreateLoanRequest = z.infer<typeof createLoanRequest>;
