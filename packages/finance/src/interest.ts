import type { Bps, Cents } from "./money";
import { cents } from "./money";

/** Quantidade de meses como fração de inteiros (7 dias = 7/30; RFC-002 §3.4). */
export interface Periods {
  readonly numerator: bigint;
  readonly denominator: bigint;
}

export class InterestError extends Error {
  readonly code = "INVALID_INTEREST";
}

/**
 * RFC-002 §3.1: principal × taxa ao mês × períodos, arredondado meio para cima UMA vez.
 * Taxa em pontos-base (633n = 6,33%). Erro se principal < 0, numerator < 0 ou denominator <= 0.
 */
export function simpleInterest(principal: Cents, monthlyRate: Bps, periods: Periods): Cents {
  if (principal < 0n || periods.numerator < 0n || periods.denominator <= 0n) {
    throw new InterestError();
  }

  const totalNumerator = principal * monthlyRate * periods.numerator;
  const totalDenominator = 10000n * periods.denominator;

  // Round half-up: floor((numerator + (denominator / 2)) / denominator)
  const result = (totalNumerator + totalDenominator / 2n) / totalDenominator;

  return cents(result);
}
