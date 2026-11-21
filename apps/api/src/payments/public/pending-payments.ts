import type { PendingPaymentsSummary } from "@pilla/schemas";
import type { Database } from "../../db/database";

export type { PendingPayment, PendingPaymentsSummary } from "@pilla/schemas";

/** Esboço (E11-T03): fila de pagamentos PENDING_REVIEW para a E13 (RF-50), implementada na E11-T04. */
export function listPendingReviewPayments(
  _db: Database,
  _opts?: { readonly limit?: number },
): Promise<PendingPaymentsSummary> {
  return Promise.reject(new Error("esboço: não implementado"));
}
