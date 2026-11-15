import { generateDueDates } from "./due-dates";
import type { Frequency } from "./due-dates";
import type { IsoDate } from "./date";
import { simpleInterest } from "./interest";
import type { Periods } from "./interest";
import type { Bps, Cents } from "./money";
import { cents } from "./money";
import { roundToStep } from "./rounding";
import { splitEvenly } from "./split";

export interface ScheduleTerms {
  readonly principal: Cents;
  readonly monthlyInterestRate: Bps;
  readonly firstDueDate: IsoDate;
  readonly frequency: Frequency;
  readonly disbursementDate: IsoDate;
  /** passo do arredondamento comercial (RN-C03), normalmente 500n. */
  readonly roundingStep: Cents;
}

/** CUSTOM não passa por aqui: as parcelas são informadas manualmente (RFC-002 §3.4). */
export type ScheduleInput =
  | (ScheduleTerms & { readonly type: "INSTALLMENT"; readonly count: number })
  | (ScheduleTerms & { readonly type: "SINGLE_PAYMENT" | "INTEREST_ONLY" });

export interface ScheduledInstallment {
  /** 1..n */
  readonly number: number;
  readonly dueDate: IsoDate;
  readonly principal: Cents;
  readonly interest: Cents;
  /** principal + interest */
  readonly total: Cents;
}

export class ScheduleError extends Error {
  readonly code = "INVALID_SCHEDULE";
}

/** Junta duas listas do mesmo tamanho; tamanhos diferentes é erro (nunca completa com valor inventado). */
export function pairUp<A, B>(left: readonly A[], right: readonly B[]): [A, B][] {
  const pairs: [A, B][] = [];
  for (const [index, a] of left.entries()) {
    const b = right[index];
    if (b === undefined || left.length !== right.length) throw new ScheduleError("lists differ in length");
    pairs.push([a, b]);
  }
  return pairs;
}

/** RN-C02: cada período vale `interval` meses (MONTH) ou `interval / 30` meses (DAY). */
export function periodsFor(frequency: Frequency, count: number): Periods {
  const months = BigInt(frequency.interval * count);
  return frequency.unit === "MONTH" ? { numerator: months, denominator: 1n } : { numerator: months, denominator: 30n };
}

/**
 * RFC-002 §3.4 / §3.4.1 (RN-C02, RN-C03).
 * INSTALLMENT e SINGLE_PAYMENT (n = 1):
 *   juros = roundToStep(simpleInterest(principal, taxa, n × fator), passo);
 *   parcela = múltiplo de passo mais próximo de (principal + juros) / n (empate sobe);
 *   principal_i = splitEvenly(principal, n)[i]; juros_i = parcela − principal_i.
 * INTEREST_ONLY: só o próximo período; juros = roundToStep(simpleInterest(principal, taxa, fator), passo), principal 0.
 * Erro se principal <= 0 ou se o arredondamento deixar juros de alguma parcela negativo.
 */
export function generateSchedule(input: ScheduleInput): ScheduledInstallment[] {
  if (input.principal <= 0n) throw new ScheduleError("principal must be positive");
  const count = input.type === "INSTALLMENT" ? input.count : 1;
  const dueDates = generateDueDates({
    firstDueDate: input.firstDueDate,
    frequency: input.frequency,
    count,
    disbursementDate: input.disbursementDate,
  });
  const exactInterest = simpleInterest(input.principal, input.monthlyInterestRate, periodsFor(input.frequency, count));
  const interest = roundToStep(exactInterest, input.roundingStep);

  if (input.type === "INTEREST_ONLY") {
    return [{ number: 1, dueDate: input.firstDueDate, principal: cents(0n), interest, total: interest }];
  }

  // Múltiplo de `passo` mais próximo de total/n = múltiplo de `passo × n` mais próximo de total, dividido por n.
  const n = BigInt(count);
  const installment = roundToStep(cents(input.principal + interest), cents(input.roundingStep * n)) / n;
  const principals = splitEvenly(input.principal, count);

  return pairUp(dueDates, principals).map(([dueDate, principal], index) => {
    const installmentInterest = installment - principal;
    if (installmentInterest < 0n) throw new ScheduleError("rounding left negative interest");
    return { number: index + 1, dueDate, principal, interest: cents(installmentInterest), total: cents(installment) };
  });
}
