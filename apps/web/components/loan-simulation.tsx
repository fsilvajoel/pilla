"use client";

import { formatReais } from "@pilla/finance";
import type { Cents, IsoDate } from "@pilla/finance";
import { useState } from "react";
import type { JSX } from "react";
import { useForm } from "react-hook-form";
import { simulate } from "@/lib/simulation";
import type { FrequencyPreset, SimulationResult } from "@/lib/simulation";
import { toSimulateRequest } from "@/lib/simulation-form";
import type { SimulationFormValues } from "@/lib/simulation-form";

export interface LoanSimulationProps {
  /** data do desembolso usada no cálculo (RFC-002: o relógio vem de fora) */
  readonly disbursementDate: IsoDate;
}

type Outcome =
  | { readonly kind: "idle" }
  | { readonly kind: "result"; readonly result: SimulationResult; readonly count: number }
  | { readonly kind: "invalid" };

const frequencyOptions: readonly { readonly value: FrequencyPreset; readonly label: string }[] = [
  { value: "WEEKLY", label: "Semanal" },
  { value: "BIWEEKLY", label: "Quinzenal" },
  { value: "MONTHLY", label: "Mensal" },
  { value: "BIMONTHLY", label: "Bimestral" },
];

const defaultValues: SimulationFormValues = {
  amount: "",
  monthlyRate: "",
  installmentCount: "",
  frequency: "MONTHLY",
  firstDueDate: "",
};

/** "AAAA-MM-DD" para "dd/mm/aaaa". */
function formatDate(date: IsoDate): string {
  return date.split("-").reverse().join("/");
}

function reais(value: Cents): string {
  return `R$ ${formatReais(value)}`;
}

/**
 * Tela de simulação do ADMIN (PRD-001 RF-10), sem gravar e sem chamar a API (ADR-0013): o cálculo roda no
 * navegador com `toSimulateRequest` e `simulate` (E6-F01). Qualquer erro da conversão ou do cálculo (MoneyError,
 * ZodError, DueDateError da RN-C04) vira o alerta "Confira os campos da simulação." no lugar do resultado.
 */
export function LoanSimulation({ disbursementDate }: LoanSimulationProps): JSX.Element {
  const { register, handleSubmit } = useForm<SimulationFormValues>({ defaultValues });
  const [outcome, setOutcome] = useState<Outcome>({ kind: "idle" });

  const onSubmit = (values: SimulationFormValues): void => {
    try {
      const request = toSimulateRequest(values);
      setOutcome({ kind: "result", result: simulate(request, disbursementDate), count: request.installmentCount });
    } catch {
      setOutcome({ kind: "invalid" });
    }
  };

  return (
    <section>
      <form onSubmit={(event) => void handleSubmit(onSubmit)(event)} noValidate>
        <label htmlFor="simulation-amount">Valor emprestado</label>
        <input id="simulation-amount" inputMode="decimal" {...register("amount")} />

        <label htmlFor="simulation-rate">Taxa ao mês (%)</label>
        <input id="simulation-rate" inputMode="decimal" {...register("monthlyRate")} />

        <label htmlFor="simulation-count">Nº de parcelas</label>
        <input id="simulation-count" inputMode="numeric" {...register("installmentCount")} />

        <label htmlFor="simulation-frequency">Periodicidade</label>
        <select id="simulation-frequency" {...register("frequency")}>
          {frequencyOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <label htmlFor="simulation-first-due-date">1º vencimento</label>
        <input id="simulation-first-due-date" type="date" {...register("firstDueDate")} />

        <button type="submit">Simular</button>
      </form>

      {outcome.kind === "invalid" && <p role="alert">Confira os campos da simulação.</p>}

      {outcome.kind === "result" && (
        <>
          <dl>
            <dt>Total a receber</dt>
            <dd>{reais(outcome.result.total)}</dd>
            <dt>Juros</dt>
            <dd>{reais(outcome.result.interest)}</dd>
            <dt>Parcela</dt>
            <dd>{`${String(outcome.count)} × ${reais(outcome.result.installmentAmount)}`}</dd>
          </dl>
          <table>
            <thead>
              <tr>
                <th>Nº</th>
                <th>Vencimento</th>
                <th>Principal</th>
                <th>Juros</th>
                <th>Parcela</th>
              </tr>
            </thead>
            <tbody>
              {outcome.result.schedule.map((line) => (
                <tr key={line.number}>
                  <td>{line.number}</td>
                  <td>{formatDate(line.dueDate)}</td>
                  <td>{formatReais(line.principal)}</td>
                  <td>{formatReais(line.interest)}</td>
                  <td>{formatReais(line.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
