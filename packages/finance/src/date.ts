// Datas de calendário sem fuso (YYYY-MM-DD), sem `Date` (relógio injetado; travas §3). Aritmética só com inteiros.

declare const isoDateBrand: unique symbol;
/** Data de calendário "AAAA-MM-DD", anos 1900 a 2999. */
export type IsoDate = string & { readonly [isoDateBrand]: true };

export class DateError extends Error {
  readonly code = "INVALID_DATE";
}

// ---------------------------------------------------------------- núcleo (pronto: use, não reescreva)

/** Marca uma string já validada como IsoDate (sem `as`). */
function assertIsoDate(_text: string): asserts _text is IsoDate {
  // só marca o tipo
}

/** Divisão inteira para valores >= 0. */
function div(a: number, b: number): number {
  return (a - (a % b)) / b;
}

function isLeap(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Dias do mês (1..12). */
export function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeap(year) ? 29 : 28;
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

export interface Civil {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

/** Número sequencial do dia (algoritmo days-from-civil, anos >= 1900). */
export function toDayNumber({ year, month, day }: Civil): number {
  const y = month <= 2 ? year - 1 : year;
  const era = div(y, 400);
  const yoe = y - era * 400;
  const doy = div(153 * (month + (month > 2 ? -3 : 9)) + 2, 5) + day - 1;
  const doe = yoe * 365 + div(yoe, 4) - div(yoe, 100) + doy;
  return era * 146097 + doe;
}

/** Inverso de toDayNumber. */
export function fromDayNumber(n: number): Civil {
  const era = div(n, 146097);
  const doe = n - era * 146097;
  const yoe = div(doe - div(doe, 1460) + div(doe, 36524) - div(doe, 146096), 365);
  const doy = doe - (365 * yoe + div(yoe, 4) - div(yoe, 100));
  const mp = div(5 * doy + 2, 153);
  const day = doy - div(153 * mp + 2, 5) + 1;
  const month = mp < 10 ? mp + 3 : mp - 9;
  return { year: yoe + era * 400 + (month <= 2 ? 1 : 0), month, day };
}

/** "AAAA-MM-DD" → partes numéricas, ou null se o formato não bate (não valida o dia). */
export function parseParts(text: string): Civil | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return null;
  const [, y = "", m = "", d = ""] = match;
  return { year: parseInt(y, 10), month: parseInt(m, 10), day: parseInt(d, 10) };
}

/** Partes de uma IsoDate já validada (sem ramo: o formato é garantido pelo tipo). */
export function civilOf(date: IsoDate): Civil {
  return {
    year: parseInt(date.slice(0, 4), 10),
    month: parseInt(date.slice(5, 7), 10),
    day: parseInt(date.slice(8, 10), 10),
  };
}

/** Partes → IsoDate, sem validar (use só com partes já válidas). */
export function formatDate({ year, month, day }: Civil): IsoDate {
  const text = `${String(year)}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  assertIsoDate(text);
  return text;
}

// ---------------------------------------------------------------- funções públicas (E1-T21)

/** Valida e marca "AAAA-MM-DD" (data real: 2027-02-29 é inválida; anos 1900..2999). Erro: DateError. */
export function isoDate(_text: string): IsoDate {
  const parts = parseParts(_text);
  if (!parts) throw new DateError();

  const { year, month, day } = parts;
  if (year < 1900 || year > 2999 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    throw new DateError();
  }

  return formatDate(parts);
}

/** Soma dias corridos (pode ser negativo): fromDayNumber(toDayNumber(...) + days). */
export function addDays(_date: IsoDate, _days: number): IsoDate {
  return formatDate(fromDayNumber(toDayNumber(civilOf(_date)) + _days));
}

/** Soma meses (>= 0, senão DateError); dia inexistente vira o último dia do mês (31/01 + 1 = 28/02). */
export function addMonths(_date: IsoDate, _months: number): IsoDate {
  if (_months < 0) throw new DateError();
  const { year, month, day } = civilOf(_date);
  const newMonth = month + _months;
  const newYear = newMonth > 12 ? year + div(newMonth - 1, 12) : year;
  const finalMonth = ((newMonth - 1) % 12) + 1;

  const maxDay = daysInMonth(newYear, finalMonth);
  const finalDay = day > maxDay ? maxDay : day;

  return formatDate({ year: newYear, month: finalMonth, day: finalDay });
}

/** Dias corridos de `from` até `to` (negativo se `to` for antes). */
export function daysBetween(_from: IsoDate, _to: IsoDate): number {
  return toDayNumber(civilOf(_to)) - toDayNumber(civilOf(_from));
}
