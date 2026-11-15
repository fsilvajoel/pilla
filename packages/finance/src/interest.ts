import type { Bps, Cents } from "./money";

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
export function simpleInterest(_principal: Cents, _monthlyRate: Bps, _periods: Periods): Cents {
  throw new Error("not implemented");
}
