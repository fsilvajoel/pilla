// @stub E6-T02
import { bps, cents, generateSchedule, isoDate } from "@pilla/finance";
import type { Cents, Frequency, IsoDate, ScheduledInstallment } from "@pilla/finance";
import type { SimulateLoanRequest } from "@pilla/schemas";

/** Periodicidades do esboço da tela (PRD-001 RF-10) com os exemplos da RN-C04. */
export type FrequencyPreset = "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "BIMONTHLY";

/** Resultado da simulação (RF-10): juros, total a receber, valor da parcela e cronograma. */
export interface SimulationResult {
  readonly interest: Cents;
  readonly total: Cents;
  readonly installmentAmount: Cents;
  readonly schedule: readonly ScheduledInstallment[];
}

/**
 * Periodicidade do motor para cada opção da tela (RN-C04): WEEKLY a cada 7 dias, BIWEEKLY a cada 15 dias,
 * MONTHLY a cada 1 mês, BIMONTHLY a cada 2 meses.
 */
export function frequencyOf(preset: FrequencyPreset): Frequency {
  switch (preset) {
    case "WEEKLY":
      return { unit: "DAY", interval: 7 };
    case "BIWEEKLY":
      return { unit: "DAY", interval: 15 };
    case "MONTHLY":
      return { unit: "MONTH", interval: 1 };
    case "BIMONTHLY":
      return { unit: "MONTH", interval: 2 };
  }
}

/**
 * Simulação no navegador (ADR-0013, RF-10), sem gravar: gera o cronograma com `generateSchedule` de `@pilla/finance`,
 * sempre do tipo INSTALLMENT com `count` = `installmentCount` (SINGLE_PAYMENT já chega com 1 parcela, RFC-002
 * §3.4), passo de arredondamento de R$ 5,00 (RN-C03). `disbursementDate` vem por parâmetro (RFC-002:
 * nada de relógio dentro do cálculo). `interest` é a soma dos juros das parcelas, `total` a soma das parcelas e
 * `installmentAmount` o valor de cada parcela, o mesmo em todas (RN-C03). Erros do motor (ex.: 1º vencimento não
 * posterior ao desembolso, RN-C04) sobem sem tratamento.
 */
export function simulate(request: SimulateLoanRequest, disbursementDate: IsoDate): SimulationResult {
  const schedule = generateSchedule({
    type: "INSTALLMENT",
    count: request.installmentCount,
    principal: cents(BigInt(request.principalCents)),
    monthlyInterestRate: bps(BigInt(request.monthlyInterestRateBps)),
    firstDueDate: isoDate(request.firstDueDate),
    frequency: request.frequency,
    disbursementDate,
    roundingStep: cents(500n),
  });

  const interest = cents(schedule.reduce((acc, line) => acc + line.interest, 0n));
  const total = cents(schedule.reduce((acc, line) => acc + line.total, 0n));
  const installmentAmount = cents(total / BigInt(request.installmentCount));

  return {
    interest,
    total,
    installmentAmount,
    schedule,
  };
}
