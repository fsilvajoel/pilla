import { z } from "zod";
import { idSchema, isoDateSchema, positiveCentsSchema } from "../../common";

/** POST /payments/allocation-preview (RFC-004). */
export const allocationPreviewRequest = z.strictObject({
  loanId: idSchema,
  amountCents: positiveCentsSchema,
  paidAt: isoDateSchema,
});
export type AllocationPreviewRequest = z.infer<typeof allocationPreviewRequest>;

/** Esboço (E11-T01): o contrato real entra na E11-T02. */
export const allocationPreviewResponse = z.never();
export type AllocationPreviewResponse = z.infer<typeof allocationPreviewResponse>;
