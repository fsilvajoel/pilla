import { z } from "zod";
import { bpsSchema, positiveCentsSchema } from "../../common";

/**
 * Corpo de PUT /settings/default-terms (RF-40): substitui o conjunto inteiro, todos obrigatórios.
 * Os tetos são limites de sanidade, não regra de negócio (pendência E13-F01).
 */
export const updateDefaultTermsRequest = z.strictObject({
  lateFeeBps: bpsSchema.max(10000),
  lateInterestMonthlyBps: bpsSchema.max(10000),
  gracePeriodDays: z.int().nonnegative().max(365),
  suggestedMonthlyRateBps: bpsSchema.max(10000),
  roundingStepCents: positiveCentsSchema.max(100000),
});
export type UpdateDefaultTermsRequest = z.infer<typeof updateDefaultTermsRequest>;
