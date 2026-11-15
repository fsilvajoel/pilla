import { z } from "zod";
import { eventV1 } from "./envelope";

// Esboço do Claude: troque SÓ o z.never() abaixo pelo payload da RFC-004 §7 (siga payment-confirmed.ts).
export const paymentReversedPayload = z.never();

/** RFC-004 §7: produtor payments; consumidores lending (reabertura), treasury (REVERSAL). */
export const paymentReversedV1 = eventV1("PaymentReversed", paymentReversedPayload);
export type PaymentReversedV1 = z.infer<typeof paymentReversedV1>;
