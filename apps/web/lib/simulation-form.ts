import { parseReais } from "@pilla/finance";
import { simulateLoanRequest } from "@pilla/schemas";
import type { SimulateLoanRequest } from "@pilla/schemas";
import { frequencyOf } from "./simulation";
import type { FrequencyPreset } from "./simulation";

/** Campos da tela de simulação como o ADMIN digita (esboço do PRD-001 RF-10). */
export interface SimulationFormValues {
  /** valor emprestado em reais, ex.: "5.000,00" */
  readonly amount: string;
  /** taxa ao mês em %, duas casas, ex.: "6,33" (= 633 bps) */
  readonly monthlyRate: string;
  /** nº de parcelas, ex.: "6" */
  readonly installmentCount: string;
  readonly frequency: FrequencyPreset;
  /** 1º vencimento "AAAA-MM-DD" (valor de um input type="date") */
  readonly firstDueDate: string;
}

/** Texto da tela fora do formato aceito (D1, D2); `message` é o texto mostrado ao usuário. */
export class FormInputError extends Error {
  readonly code = "INVALID_FORM_INPUT";
}

const INTEGER_DIGITS = /^\d+$/;

function parseInstallmentCount(text: string): number {
  if (!INTEGER_DIGITS.test(text)) throw new FormInputError("Use somente números inteiros");
  return Number(text);
}

/**
 * Converte os campos da tela no corpo `SimulateLoanRequest` (RFC-004 §5, ADR-0013: Zod de `@pilla/schemas`),
 * com type INSTALLMENT. Valor e taxa passam por `parseReais` de `@pilla/finance` ("6,33" vira 633), a
 * periodicidade por `frequencyOf` de `./simulation`, e o resultado por `simulateLoanRequest.parse`. Texto fora
 * do formato lança o erro de `parseReais` (MoneyError) ou do Zod (ZodError).
 */
export function toSimulateRequest(values: SimulationFormValues): SimulateLoanRequest {
  return simulateLoanRequest.parse({
    type: "INSTALLMENT",
    principalCents: Number(parseReais(values.amount)),
    // taxa em % com duas casas: "6,33" vira 633 bps
    monthlyInterestRateBps: Number(parseReais(values.monthlyRate)),
    installmentCount: parseInstallmentCount(values.installmentCount),
    frequency: frequencyOf(values.frequency),
    firstDueDate: values.firstDueDate,
  });
}
