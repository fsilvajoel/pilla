import { cents, formatReais, parseReais } from "@pilla/finance";
import type { DefaultTermsResponse, UpdateDefaultTermsRequest } from "@pilla/schemas";

/** Campos como o ADMIN digita: % e R$ com vírgula e duas casas, carência em dias inteiros. */
export interface DefaultTermsFormValues {
  readonly lateFee: string;
  readonly lateInterest: string;
  readonly gracePeriodDays: string;
  readonly suggestedRate: string;
  readonly roundingStep: string;
}

/** Nome do campo da API (problem+json) para o campo do formulário. */
export const FIELD_OF_API: Readonly<Record<string, keyof DefaultTermsFormValues>> = {
  lateFeeBps: "lateFee",
  lateInterestMonthlyBps: "lateInterest",
  gracePeriodDays: "gracePeriodDays",
  suggestedMonthlyRateBps: "suggestedRate",
  roundingStepCents: "roundingStep",
};

function text(value: number): string {
  return formatReais(cents(BigInt(value)));
}

/** bps e centavos viram texto com `formatReais` (633 vira "6,33"). */
export function toFormValues(terms: DefaultTermsResponse): DefaultTermsFormValues {
  return {
    lateFee: text(terms.lateFeeBps),
    lateInterest: text(terms.lateInterestMonthlyBps),
    gracePeriodDays: String(terms.gracePeriodDays),
    suggestedRate: text(terms.suggestedMonthlyRateBps),
    roundingStep: text(terms.roundingStepCents),
  };
}

const DECIMAL = /^\d+,\d{2}$/;
const INTEGER = /^\d+$/;

export type ParsedTerms =
  | { readonly ok: true; readonly data: UpdateDefaultTermsRequest }
  | { readonly ok: false; readonly fieldErrors: Readonly<Partial<Record<keyof DefaultTermsFormValues, string>>> };

/** Converte o texto em bps/centavos com `parseReais` (inteiros, sem ponto flutuante). Os limites ficam com a API. */
export function toUpdateRequest(values: DefaultTermsFormValues): ParsedTerms {
  const errors: Partial<Record<keyof DefaultTermsFormValues, string>> = {};
  const decimal = (key: "lateFee" | "lateInterest" | "suggestedRate" | "roundingStep"): number => {
    const raw = values[key].trim();
    if (!DECIMAL.test(raw)) {
      errors[key] = "Use o formato 0,00";
      return 0;
    }
    return Number(parseReais(raw));
  };
  const lateFeeBps = decimal("lateFee");
  const lateInterestMonthlyBps = decimal("lateInterest");
  const suggestedMonthlyRateBps = decimal("suggestedRate");
  const roundingStepCents = decimal("roundingStep");
  const graceRaw = values.gracePeriodDays.trim();
  if (!INTEGER.test(graceRaw)) errors.gracePeriodDays = "Use somente números inteiros";
  if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors };
  return {
    ok: true,
    data: {
      lateFeeBps,
      lateInterestMonthlyBps,
      gracePeriodDays: Number(graceRaw),
      suggestedMonthlyRateBps,
      roundingStepCents,
    },
  };
}
