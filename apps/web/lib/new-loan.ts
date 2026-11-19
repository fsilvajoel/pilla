import { cents, formatReais, parseReais } from "@pilla/finance";
import { createLoanRequest } from "@pilla/schemas";
import type { CreateLoanRequest, DefaultTermsResponse } from "@pilla/schemas";
import { toSimulateRequest } from "./simulation-form";
import type { SimulationFormValues } from "./simulation-form";

/** Campos do novo contrato como o ADMIN digita: os da simulação mais cliente, encargos e observações (RF-11, RF-41). */
export interface NewLoanFormValues extends SimulationFormValues {
  /** id de uma pessoa cadastrada, ou "" enquanto nada foi escolhido */
  readonly personId: string;
  /** multa em %, duas casas, ex.: "2,00" (= 200 bps) */
  readonly lateFee: string;
  /** mora ao mês em %, duas casas, ex.: "1,00" (= 100 bps) */
  readonly lateInterest: string;
  /** carência em dias, ex.: "0" */
  readonly gracePeriodDays: string;
  /** texto livre; "" = ausente */
  readonly internalNotes: string;
}

function bpsText(bps: number): string {
  return formatReais(cents(BigInt(bps)));
}

/**
 * Valores iniciais do formulário (RF-41: os parâmetros vêm preenchidos com o padrão e podem ser ajustados).
 * `monthlyRate`, `lateFee` e `lateInterest` são os bps do padrão escritos com `formatReais` de `@pilla/finance`
 * (633 bps vira "6,33"), `gracePeriodDays` é o número em texto, `frequency` é "MONTHLY" e os outros campos
 * (`amount`, `installmentCount`, `firstDueDate`, `personId`, `internalNotes`) começam como "".
 */
export function newLoanFormDefaults(defaults: DefaultTermsResponse): NewLoanFormValues {
  return {
    amount: "",
    monthlyRate: bpsText(defaults.suggestedMonthlyRateBps),
    installmentCount: "",
    frequency: "MONTHLY",
    firstDueDate: "",
    personId: "",
    lateFee: bpsText(defaults.lateFeeBps),
    lateInterest: bpsText(defaults.lateInterestMonthlyBps),
    gracePeriodDays: String(defaults.gracePeriodDays),
    internalNotes: "",
  };
}

/**
 * Converte os campos no corpo de POST /loans (RF-11, decisões do Joel de 17/11). A parte da simulação vem de
 * `toSimulateRequest` de `./simulation-form`; `lateFee` e `lateInterest` passam por `parseReais` ("2,00" vira
 * 200), `gracePeriodDays` vira número, `internalNotes` vazio fica de fora, e o objeto inteiro passa por
 * `createLoanRequest.parse` de `@pilla/schemas`. Texto fora do formato lança MoneyError (de `parseReais`) ou
 * ZodError (do Zod), sem tratamento.
 */
export function toCreateLoanRequest(values: NewLoanFormValues): CreateLoanRequest {
  return createLoanRequest.parse({
    ...toSimulateRequest(values),
    personId: values.personId,
    lateFeeBps: Number(parseReais(values.lateFee)),
    lateInterestMonthlyBps: Number(parseReais(values.lateInterest)),
    gracePeriodDays: Number(values.gracePeriodDays),
    ...(values.internalNotes === "" ? {} : { internalNotes: values.internalNotes }),
  });
}
