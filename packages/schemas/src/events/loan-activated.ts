import { z } from "zod";
import { eventV1 } from "./envelope";

// Esboço do Claude: troque SÓ o z.never() abaixo pelo payload da RFC-004 §7 (siga payment-confirmed.ts).
export const loanActivatedPayload = z.never();

/** RFC-004 §7: produtor lending; consumidores treasury (DISBURSEMENT), lending (contrato de origem). */
export const loanActivatedV1 = eventV1("LoanActivated", loanActivatedPayload);
export type LoanActivatedV1 = z.infer<typeof loanActivatedV1>;
