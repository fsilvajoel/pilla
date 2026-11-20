import type { Cents } from "./money";
import { cents } from "./money";

export class RoundingError extends Error {
  readonly code = "INVALID_ROUNDING";
}

/**
 * RN-C03: múltiplo de `step` mais próximo; empate sobe (9.250 → 9.500 com passo 500).
 * Erro se `step` <= 0 ou `value` < 0.
 */
export function roundToStep(value: Cents, step: Cents): Cents {
  if (step <= 0n || value < 0n) {
    throw new RoundingError("Step must be positive and value must be non-negative");
  }

  const quotient = value / step;
  const remainder = value % step;

  if (remainder * 2n >= step) {
    return cents((quotient + 1n) * step);
  }

  return cents(quotient * step);
}
