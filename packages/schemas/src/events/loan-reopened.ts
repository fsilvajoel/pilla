import { z } from "zod";
import { eventV1 } from "./envelope";

// Esboço do Claude: troque SÓ o z.never() abaixo pelo payload da RFC-004 §7 (siga payment-confirmed.ts).
export const loanReopenedPayload = z.never();

/** RFC-004 §7: produtor lending; consumidores treasury. */
export const loanReopenedV1 = eventV1("LoanReopened", loanReopenedPayload);
export type LoanReopenedV1 = z.infer<typeof loanReopenedV1>;
