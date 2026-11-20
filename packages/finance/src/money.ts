// Dinheiro em centavos inteiros e taxas em pontos-base (ADR-0004; travas §2).
// Tipos de marca: impossível somar Cents com Bps ou passar um bigint qualquer onde se espera dinheiro.

declare const centsBrand: unique symbol;
declare const bpsBrand: unique symbol;

/** Valor em centavos (R$ 1,00 = 100n). */
export type Cents = bigint & { readonly [centsBrand]: true };
/** Taxa em pontos-base (6,33% = 633n). */
export type Bps = bigint & { readonly [bpsBrand]: true };

// Funções de asserção: aplicam a marca sem `as` (proibido pelo lint) e sem ramo morto.
function assertCents(_value: bigint): asserts _value is Cents {
  // só marca o tipo
}
function assertBps(_value: bigint): asserts _value is Bps {
  // só marca o tipo
}

export class MoneyError extends Error {
  readonly code = "INVALID_MONEY";
}

/** Marca um bigint como centavos. */
export function cents(value: bigint): Cents {
  assertCents(value);
  return value;
}

/** Marca um bigint como pontos-base; taxa negativa é erro. */
export function bps(value: bigint): Bps {
  if (value < 0n) throw new MoneyError(`taxa negativa: ${String(value)}`);
  assertBps(value);
  return value;
}

const REAIS = /^(-)?(\d{1,3}(?:\.\d{3})*|\d+),(\d{2})$/;

/** "1.234,56" → 123456n. Exige exatamente duas casas decimais. */
export function parseReais(text: string): Cents {
  const match = REAIS.exec(text.trim());
  if (!match) throw new MoneyError(`valor inválido: ${text}`);
  const [, sign, integer = "", fraction = ""] = match;
  const value = BigInt(integer.replaceAll(".", "")) * 100n + BigInt(fraction);
  return cents(sign ? -value : value);
}

/** 123456n → "1.234,56". */
export function formatReais(value: Cents): string {
  const raw: bigint = value;
  const negative = raw < 0n;
  const abs = negative ? -raw : raw;
  const integer = (abs / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const fraction = (abs % 100n).toString().padStart(2, "0");
  return `${negative ? "-" : ""}${integer},${fraction}`;
}
