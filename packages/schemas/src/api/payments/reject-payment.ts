import { z } from "zod";
import { reasonSchema } from "../../common";

/** POST /payments/{id}/reject (RFC-004 §3): descarta o pagamento pendente com motivo, mesmo `reasonSchema` do estorno. */
export const rejectPaymentRequest = z.strictObject({
  reason: reasonSchema,
});
export type RejectPaymentRequest = z.infer<typeof rejectPaymentRequest>;
