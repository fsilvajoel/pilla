import { z } from "zod";

/** Esboço (E13-T01): só a forma; os limites entram na E13-T02. */
export const updateDefaultTermsRequest = z.strictObject({
  lateFeeBps: z.int(),
  lateInterestMonthlyBps: z.int(),
  gracePeriodDays: z.int(),
  suggestedMonthlyRateBps: z.int(),
  roundingStepCents: z.int(),
});
export type UpdateDefaultTermsRequest = z.infer<typeof updateDefaultTermsRequest>;
