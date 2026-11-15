import { z } from "zod";
import { eventV1 } from "./envelope";

// Esboço do Claude: troque SÓ o z.never() abaixo pelo payload da RFC-004 §7 (siga payment-confirmed.ts).
export const installmentOverduePayload = z.never();

/** RFC-004 §7: produtor lending (rotina diária); consumidores — (futuro: messaging, risk). */
export const installmentOverdueV1 = eventV1("InstallmentOverdue", installmentOverduePayload);
export type InstallmentOverdueV1 = z.infer<typeof installmentOverdueV1>;
