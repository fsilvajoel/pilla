import { daysBetween, addDays, addMonths } from "./date";
import type { IsoDate } from "./date";

export interface Frequency {
  readonly unit: "DAY" | "MONTH";
  readonly interval: number;
}

export interface DueDatesInput {
  readonly firstDueDate: IsoDate;
  readonly frequency: Frequency;
  readonly count: number;
  readonly disbursementDate: IsoDate;
}

export class DueDateError extends Error {
  readonly code = "INVALID_DUE_DATES";
}

/**
 * RFC-002 §3.3 / RN-C04. Parcela i (1..count):
 * MONTH → addMonths(firstDueDate, (i-1) × interval), sempre a partir da data ORIGINAL;
 * DAY → addDays(firstDueDate, (i-1) × interval).
 * Erro se interval < 1, count < 1 ou firstDueDate <= disbursementDate. Use as funções de ./date.
 */
export function generateDueDates(_input: DueDatesInput): IsoDate[] {
  const { firstDueDate, frequency, count, disbursementDate } = _input;

  if (frequency.interval < 1 || count < 1) {
    throw new DueDateError();
  }

  if (daysBetween(disbursementDate, firstDueDate) <= 0) {
    throw new DueDateError();
  }

  const dates: IsoDate[] = [];

  for (let i = 0; i < count; i++) {
    const dueDate =
      frequency.unit === "DAY"
        ? addDays(firstDueDate, i * frequency.interval)
        : addMonths(firstDueDate, i * frequency.interval);

    dates.push(dueDate);
  }

  return dates;
}
