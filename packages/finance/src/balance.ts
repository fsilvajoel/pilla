import { daysBetween } from "./date";
import type { IsoDate } from "./date";
import type { Bps, Cents } from "./money";
import { cents } from "./money";
import { lateChargesWithHistory } from "./partial-charges";
import type { InstallmentPayment } from "./partial-charges";

/** Parcela com o que falta pagar (principal e juros), já descontadas as alocações confirmadas. */
export interface OpenInstallment {
  readonly number: number;
  readonly dueDate: IsoDate;
  readonly openPrincipal: Cents;
  readonly openInterest: Cents;
  /** pagamentos confirmados da parcela (opcional; sem ele, encargos como na E3/E4). */
  readonly payments?: readonly InstallmentPayment[];
}

/** Condições de atraso congeladas no contrato (RN-C12, ADR-0008). */
export interface LateTerms {
  readonly finePercent: Bps;
  readonly lateInterestMonthlyRate: Bps;
  readonly graceDays: number;
  readonly roundingStep: Cents;
}

export type LoanStanding = "CURRENT" | "OVERDUE";

/** principal + juros em aberto da parcela (base dos encargos; encargos não geram encargos). */
export function openAmount(installment: OpenInstallment): Cents {
  return cents(installment.openPrincipal + installment.openInterest);
}

/** RN-E01/RN-E02: encargos da parcela na data `ref` (total já arredondado ao passo, RN-C03); usa o histórico, se houver. */
export function lateChargesAt(installment: OpenInstallment, terms: LateTerms, ref: IsoDate): Cents {
  return lateChargesWithHistory(installment, terms, ref);
}

/** RFC-002 §3.7: Σ (principal + juros em aberto) + encargos na data `ref`, inclusive parcelas futuras. */
export function outstandingBalance(installments: readonly OpenInstallment[], terms: LateTerms, ref: IsoDate): Cents {
  return cents(installments.reduce((total, i) => total + openAmount(i) + lateChargesAt(i, terms, ref), 0n));
}

/** RN-C08: quitação antecipada sem desconto = saldo devedor total. */
export function payoffAmount(installments: readonly OpenInstallment[], terms: LateTerms, ref: IsoDate): Cents {
  return outstandingBalance(installments, terms, ref);
}

/** RFC-002 §3.7: OVERDUE se alguma parcela com valor em aberto passou da carência na data `ref`. */
export function loanStanding(installments: readonly OpenInstallment[], terms: LateTerms, ref: IsoDate): LoanStanding {
  const overdue = installments.some((i) => openAmount(i) > 0n && daysBetween(i.dueDate, ref) > terms.graceDays);
  return overdue ? "OVERDUE" : "CURRENT";
}
