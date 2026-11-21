import { cents, formatReais, parseReais } from "@pilla/finance";
import { updateLoanRequest } from "@pilla/schemas";
import type { LoanDetailResponse, UpdateLoanRequest } from "@pilla/schemas";
import { toSimulateRequest } from "@/lib/simulation-form";
import type { SimulationFormValues } from "@/lib/simulation-form";
import { frequencyOf } from "@/lib/simulation";
import type { FrequencyPreset } from "@/lib/simulation";

/** Campos da edição do rascunho como o ADMIN digita (E10-T21); `internalNotes` vazio = não alterar. */
export interface EditLoanFormValues extends SimulationFormValues {
  readonly lateFee: string;
  readonly lateInterest: string;
  readonly gracePeriodDays: string;
  readonly internalNotes: string;
}

const PRESETS: readonly FrequencyPreset[] = ["WEEKLY", "BIWEEKLY", "MONTHLY", "BIMONTHLY"];

/** Opção da tela que corresponde à periodicidade do contrato; sem correspondência, MONTHLY. */
export function presetOfFrequency(frequency: LoanDetailResponse["frequency"]): FrequencyPreset {
  return (
    PRESETS.find((preset) => {
      const candidate = frequencyOf(preset);
      return candidate.unit === frequency.unit && candidate.interval === frequency.interval;
    }) ?? "MONTHLY"
  );
}

function bpsText(bps: number): string {
  return formatReais(cents(BigInt(bps)));
}

/** Valores iniciais do formulário a partir do detalhe do contrato (as observações internas não vêm no detalhe). */
export function editLoanFormDefaults(loan: LoanDetailResponse): EditLoanFormValues {
  return {
    amount: formatReais(cents(BigInt(loan.principalCents))),
    monthlyRate: bpsText(loan.monthlyInterestRateBps),
    installmentCount: String(loan.installmentCount),
    frequency: presetOfFrequency(loan.frequency),
    firstDueDate: loan.firstDueDate,
    lateFee: bpsText(loan.lateFeeBps),
    lateInterest: bpsText(loan.lateInterestMonthlyBps),
    gracePeriodDays: String(loan.gracePeriodDays),
    internalNotes: "",
  };
}

/**
 * Converte os campos no corpo de PATCH /loans/{id}. O tipo do contrato não muda; em SINGLE_PAYMENT o nº de
 * parcelas fica de fora (é sempre 1). Texto fora do formato lança MoneyError, FormInputError ou ZodError.
 */
export function toUpdateLoanRequest(values: EditLoanFormValues, type: LoanDetailResponse["type"]): UpdateLoanRequest {
  const base = toSimulateRequest({
    ...values,
    installmentCount: type === "INSTALLMENT" ? values.installmentCount : "1",
  });
  return updateLoanRequest.parse({
    principalCents: base.principalCents,
    monthlyInterestRateBps: base.monthlyInterestRateBps,
    ...(type === "INSTALLMENT" ? { installmentCount: base.installmentCount } : {}),
    frequency: base.frequency,
    firstDueDate: base.firstDueDate,
    lateFeeBps: Number(parseReais(values.lateFee)),
    lateInterestMonthlyBps: Number(parseReais(values.lateInterest)),
    gracePeriodDays: Number(values.gracePeriodDays),
    ...(values.internalNotes === "" ? {} : { internalNotes: values.internalNotes }),
  });
}
