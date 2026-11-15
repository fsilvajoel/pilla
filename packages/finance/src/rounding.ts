import type { Cents } from "./money";

export class RoundingError extends Error {
  readonly code = "INVALID_ROUNDING";
}

/**
 * RN-C03: múltiplo de `step` mais próximo; empate sobe (9.250 → 9.500 com passo 500).
 * Erro se `step` <= 0 ou `value` < 0.
 */
export function roundToStep(_value: Cents, _step: Cents): Cents {
  throw new Error("not implemented");
}
