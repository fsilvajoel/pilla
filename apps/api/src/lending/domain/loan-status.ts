// Regras do status do contrato que não dependem de banco (RFC-001 M2, PRD-001 §Recebimentos).

/** Glossário: status do contrato; a mesma lista do check `loans_status_check` (RFC-005 `loans.status`). */
export type LoanStatus = "DRAFT" | "ACTIVE" | "PAID_OFF" | "RENEWED" | "RENEGOTIATED" | "WRITTEN_OFF" | "CANCELLED";

/**
 * RN-R09: true para os status que não aceitam pagamento (PAID_OFF, RENEWED, RENEGOTIATED e CANCELLED).
 * WRITTEN_OFF aceita pagamento de recuperação (RN-C20).
 */
export function isClosedForPayments(status: LoanStatus): boolean {
  return status === "PAID_OFF" || status === "RENEWED" || status === "RENEGOTIATED" || status === "CANCELLED";
}
