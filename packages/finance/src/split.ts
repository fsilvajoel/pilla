import type { Cents } from "./money";

export class SplitError extends Error {
  readonly code = "INVALID_SPLIT";
}

/**
 * RFC-002 §3.2: base = floor(total / parts); partes 1..parts-1 = base; a última leva o resto.
 * A soma das partes é sempre igual a `total`. Erro se parts < 1 ou total < 0.
 */
export function splitEvenly(_total: Cents, _parts: number): Cents[] {
  throw new Error("not implemented");
}
