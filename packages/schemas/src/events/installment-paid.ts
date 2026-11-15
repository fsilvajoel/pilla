import { z } from "zod";
import { eventV1 } from "./envelope";

// Esboço do Claude: troque SÓ o z.never() abaixo pelo payload da RFC-004 §7 (siga payment-confirmed.ts).
export const installmentPaidPayload = z.never();

/** RFC-004 §7: produtor payments; consumidores — (futuro: risk). */
export const installmentPaidV1 = eventV1("InstallmentPaid", installmentPaidPayload);
export type InstallmentPaidV1 = z.infer<typeof installmentPaidV1>;
