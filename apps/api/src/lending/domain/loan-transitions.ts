// Transições de status do empréstimo que não dependem de banco (RFC-005 §8, RN-C06).
import type { LoanStatus } from "./loan-status";

/** RN-C06: só o rascunho pode ser editado. */
export function canEdit(status: LoanStatus): boolean {
  return status === "DRAFT";
}

/** Só o rascunho pode ser cancelado. */
export function canCancel(status: LoanStatus): boolean {
  return status === "DRAFT";
}

/** Só o rascunho pode ser ativado. */
export function canActivate(status: LoanStatus): boolean {
  return status === "DRAFT";
}

/** Só o contrato ativo pode ser renovado. */
export function canRenew(status: LoanStatus): boolean {
  return status === "ACTIVE";
}

/** Só o contrato ativo pode ser renegociado. */
export function canRenegotiate(status: LoanStatus): boolean {
  return status === "ACTIVE";
}

/** Só o contrato ativo pode ser baixado como perda. */
export function canWriteOff(status: LoanStatus): boolean {
  return status === "ACTIVE";
}
