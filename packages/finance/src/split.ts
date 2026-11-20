import type { Cents } from "./money";
import { cents } from "./money";

export class SplitError extends Error {
  readonly code = "INVALID_SPLIT";
}

/**
 * RFC-002 §3.2: base = floor(total / parts); partes 1..parts-1 = base; a última leva o resto.
 * A soma das partes é sempre igual a `total`. Erro se parts < 1 ou total < 0.
 */
export function splitEvenly(total: Cents, parts: number): Cents[] {
  if (parts < 1) {
    throw new SplitError("parts must be at least 1");
  }
  if (total < 0n) {
    throw new SplitError("total cannot be negative");
  }

  const base = total / BigInt(parts);
  const remainder = total % BigInt(parts);

  const result: Cents[] = [];
  for (let i = 0; i < parts; i++) {
    if (i === parts - 1) {
      result.push(cents(base + remainder));
    } else {
      result.push(cents(base));
    }
  }

  return result;
}
