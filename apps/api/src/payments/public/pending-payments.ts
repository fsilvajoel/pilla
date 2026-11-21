import type { PendingPaymentsSummary } from "@pilla/schemas";
import type { Database } from "../../db/database";
import { readPendingReview } from "../infra/pending-reader";

export type { PendingPayment, PendingPaymentsSummary } from "@pilla/schemas";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * Fila de pagamentos PENDING_REVIEW para a E13 (RF-50): do mais antigo para o mais novo, só ids e valores.
 * `count` e `totalCents` cobrem todas as pendentes; `items` respeita `limit` (padrão 50, máximo 200).
 */
export function listPendingReviewPayments(
  db: Database,
  opts?: { readonly limit?: number },
): Promise<PendingPaymentsSummary> {
  return readPendingReview(db, Math.min(Math.max(opts?.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT));
}
