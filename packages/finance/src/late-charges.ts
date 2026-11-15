import type { IsoDate } from "./date";
import type { Bps, Cents } from "./money";

export interface LateChargesInput {
  /** principal + juros em aberto da parcela (encargos não geram encargos). */
  readonly openAmount: Cents;
  readonly dueDate: IsoDate;
  /** data de referência (hoje ou data do pagamento). */
  readonly referenceDate: IsoDate;
  /** multa única, em pontos-base sobre o em aberto. */
  readonly finePercent: Bps;
  /** juros de mora ao mês, em pontos-base; pro rata die com mês de 30 dias. */
  readonly lateInterestMonthlyRate: Bps;
  readonly graceDays: number;
  /** passo do arredondamento comercial (RN-C03), normalmente 500n. */
  readonly roundingStep: Cents;
}

export interface LateCharges {
  readonly fine: Cents;
  readonly lateInterest: Cents;
  /** roundToStep(fine + lateInterest, roundingStep). */
  readonly total: Cents;
}

/**
 * RFC-002 §3.5 / RN-E01, RN-E02. days = daysBetween(dueDate, referenceDate).
 * Se days <= graceDays ou openAmount = 0 → tudo zero (T-07).
 * fine = meio-para-cima(openAmount × finePercent / 10000);
 * lateInterest = meio-para-cima(openAmount × lateInterestMonthlyRate × days / (10000 × 30));
 * total = roundToStep(fine + lateInterest, roundingStep).
 */
export function calculateLateCharges(_input: LateChargesInput): LateCharges {
  throw new Error("not implemented");
}
