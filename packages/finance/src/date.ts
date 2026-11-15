// Datas de calendário sem fuso (YYYY-MM-DD), sem `Date` (relógio injetado; travas §3). Aritmética só com inteiros.

declare const isoDateBrand: unique symbol;
/** Data de calendário "AAAA-MM-DD", anos 1900 a 2999. */
export type IsoDate = string & { readonly [isoDateBrand]: true };

export class DateError extends Error {
  readonly code = "INVALID_DATE";
}

/** Valida e marca "AAAA-MM-DD" (data real: 2027-02-29 é inválida). */
export function isoDate(_text: string): IsoDate {
  throw new Error("not implemented");
}

/** Soma dias corridos (pode ser negativo). */
export function addDays(_date: IsoDate, _days: number): IsoDate {
  throw new Error("not implemented");
}

/** Soma meses (>= 0); dia inexistente vira o último dia do mês (31/01 + 1 = 28/02). */
export function addMonths(_date: IsoDate, _months: number): IsoDate {
  throw new Error("not implemented");
}

/** Dias corridos de `from` até `to` (negativo se `to` for antes). */
export function daysBetween(_from: IsoDate, _to: IsoDate): number {
  throw new Error("not implemented");
}
