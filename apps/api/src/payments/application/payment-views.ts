import { paymentMethodSchema, paymentStatusSchema, type PaymentListItem, type PaymentResponse } from "@pilla/schemas";
import { ProblemException } from "../../core/http/problem-exception";
import type { PaymentLoan } from "../../lending/public/loan-for-payment";
import type { PaymentRow } from "../infra/schema";

/** Valor de um mapa de apoio (nome da pessoa, número do contrato); falta é dado inconsistente entre módulos. */
export function lookedUp(values: ReadonlyMap<string, string>, id: string, what: string): string {
  const value = values.get(id);
  if (value === undefined) throw new ProblemException("INTERNAL_ERROR", `${what} do pagamento não encontrado.`);
  return value;
}

const instantOf = (date: Date | null): string | null => (date === null ? null : date.toISOString());

/** Linha da lista (RFC-004 §3). */
export function toListItem(
  row: PaymentRow,
  loanNumbers: ReadonlyMap<string, string>,
  personNames: ReadonlyMap<string, string>,
): PaymentListItem {
  return {
    id: row.id,
    loanId: row.loanId,
    loanNumber: lookedUp(loanNumbers, row.loanId, "Número do contrato"),
    personId: row.personId,
    personName: lookedUp(personNames, row.personId, "Pessoa"),
    accountId: row.accountId,
    paidAt: row.paidAt,
    amountCents: row.amountCents,
    method: paymentMethodSchema.parse(row.method),
    status: paymentStatusSchema.parse(row.status),
    isRecovery: row.isRecovery,
    createdAt: row.createdAt.toISOString(),
    confirmedAt: instantOf(row.confirmedAt),
    reversedAt: instantOf(row.reversedAt),
  };
}

/** Resposta de POST /payments: sem alocação, que só existe depois da confirmação (F03). */
export function toPaymentResponse(
  row: PaymentRow,
  loan: PaymentLoan,
  personNames: ReadonlyMap<string, string>,
): PaymentResponse {
  const item = toListItem(row, new Map([[loan.id, loan.loanNumber]]), personNames);
  return {
    ...item,
    version: row.version,
    reversalReason: row.reversalReason,
    loanStatus: loan.status,
    allocations: [],
  };
}
