import { daysBetween } from "./date";
import type { IsoDate } from "./date";
import { cents } from "./money";
import { roundToStep } from "./rounding";
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
export function calculateLateCharges(input: LateChargesInput): LateCharges {
  const { openAmount, dueDate, referenceDate, finePercent, lateInterestMonthlyRate, graceDays, roundingStep } = input;

  const diff = daysBetween(dueDate, referenceDate);

  if (diff <= graceDays || openAmount === 0n) {
    return {
      fine: cents(0n),
      lateInterest: cents(0n),
      total: cents(0n),
    };
  }

  // fine = meio-para-cima(openAmount × finePercent / 10000);
  const fineRaw = (openAmount * finePercent + 5000n) / 10000n;
  const fine = cents(fineRaw);

  // lateInterest = meio-para-cima(openAmount × lateInterestMonthlyRate × days / (10000 × 30));
  const numerator = openAmount * lateInterestMonthlyRate * BigInt(diff);
  const lateInterestRaw = (numerator + 150000n) / 300000n;
  const lateInterest = cents(lateInterestRaw);

  const sum = fine + lateInterest;

  const total = roundToStep(cents(sum), roundingStep); // RN-C03: uma fonte só para o arredondamento

  return {
    fine,
    lateInterest,
    total,
  };
}
