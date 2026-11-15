import { z } from "zod";
import { eventV1 } from "./envelope";

// Esboço do Claude: troque SÓ o z.never() abaixo pelo payload da RFC-004 §7 (siga payment-confirmed.ts).
export const loanRenewedPayload = z.never();

/** RFC-004 §7: produtor lending; consumidores treasury. */
export const loanRenewedV1 = eventV1("LoanRenewed", loanRenewedPayload);
export type LoanRenewedV1 = z.infer<typeof loanRenewedV1>;
