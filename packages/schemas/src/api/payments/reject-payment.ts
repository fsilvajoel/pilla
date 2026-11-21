import { z } from "zod";

// Esboço (LI-068): o contrato real entra no cartão E11-T17.
/** POST /payments/{id}/reject (RFC-004 §3). */
export const rejectPaymentRequest = z.strictObject({});
export type RejectPaymentRequest = z.infer<typeof rejectPaymentRequest>;
