import { z } from "zod";
import { eventV1 } from "./envelope";

// Esboço do Claude: troque SÓ o z.never() abaixo pelo payload da RFC-004 §7 (siga payment-confirmed.ts).
export const loanRenegotiatedPayload = z.never();

/** RFC-004 §7: produtor lending; consumidores treasury. */
export const loanRenegotiatedV1 = eventV1("LoanRenegotiated", loanRenegotiatedPayload);
export type LoanRenegotiatedV1 = z.infer<typeof loanRenegotiatedV1>;
