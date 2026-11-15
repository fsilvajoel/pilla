import { z } from "zod";
import { eventV1 } from "./envelope";

// Esboço do Claude: troque SÓ o z.never() abaixo pelo payload da RFC-004 §7 (siga payment-confirmed.ts).
export const loanWrittenOffPayload = z.never();

/** RFC-004 §7: produtor lending; consumidores treasury (perdas). */
export const loanWrittenOffV1 = eventV1("LoanWrittenOff", loanWrittenOffPayload);
export type LoanWrittenOffV1 = z.infer<typeof loanWrittenOffV1>;
