// Efeito do estorno de um pagamento sobre o status do contrato (PRD-001 RN-R10 e RN-R11).
import type { LoanStatus } from "./loan-status";

/** RN-R11: true quando o estorno é bloqueado, porque o contrato é RENEWED ou RENEGOTIATED. */
export function isReversalBlocked(status: LoanStatus): boolean {
  return status === "RENEWED" || status === "RENEGOTIATED";
}

/**
 * RN-R10: true quando o estorno reabre o contrato (volta para ACTIVE), isto é, o contrato é PAID_OFF e o
 * saldo devedor depois do estorno (`outstandingCents`, centavos em bigint, ADR-0004) é maior que zero.
 */
export function reopensOnReversal(status: LoanStatus, outstandingCents: bigint): boolean {
  return status === "PAID_OFF" && outstandingCents > 0n;
}
