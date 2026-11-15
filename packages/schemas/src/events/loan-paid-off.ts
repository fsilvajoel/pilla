import { z } from "zod";
import { eventV1 } from "./envelope";

// Esboço do Claude: troque SÓ o z.never() abaixo pelo payload da RFC-004 §7 (siga payment-confirmed.ts).
export const loanPaidOffPayload = z.never();

/** RFC-004 §7: produtor lending; consumidores treasury. */
export const loanPaidOffV1 = eventV1("LoanPaidOff", loanPaidOffPayload);
export type LoanPaidOffV1 = z.infer<typeof loanPaidOffV1>;
