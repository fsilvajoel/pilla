"use client";

import type { CreateLoanRequest, DefaultTermsResponse, PersonSummary } from "@pilla/schemas";
import type { JSX } from "react";
import type { NewLoanFormValues } from "@/lib/new-loan";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { newLoanFormDefaults, toCreateLoanRequest } from "@/lib/new-loan";

export interface NewLoanFormProps {
  /** opções do "Cliente" */
  readonly people: readonly PersonSummary[];
  /** parâmetros padrão (GET /settings/default-terms, RF-40) que preenchem o formulário (RF-41) */
  readonly defaults: DefaultTermsResponse;
  /** recebe o corpo validado de POST /loans; sem API ainda (dados de mentira, decisões do Joel de 17/11) */
  readonly onSubmit?: (request: CreateLoanRequest) => void;
}

type Outcome = "idle" | "ok" | "error";

const frequencies: readonly { readonly value: NewLoanFormValues["frequency"]; readonly label: string }[] = [
  { value: "WEEKLY", label: "Semanal" },
  { value: "BIWEEKLY", label: "Quinzenal" },
  { value: "MONTHLY", label: "Mensal" },
  { value: "BIMONTHLY", label: "Bimestral" },
];

/**
 * Novo contrato do ADMIN (PRD-001 RF-11 e RF-41). Formulário React Hook Form com `NewLoanFormValues` de
 * `@/lib/new-loan`, valores iniciais de `newLoanFormDefaults(defaults)`, cada campo com rótulo: "Cliente" (select
 * com a opção value "" e texto "Selecione", depois uma opção por pessoa, value = id e texto = fullName), "Valor
 * emprestado", "Taxa ao mês (%)", "Nº de parcelas", "Periodicidade" (select com value WEEKLY, BIWEEKLY, MONTHLY,
 * BIMONTHLY e texto Semanal, Quinzenal, Mensal, Bimestral), "1º vencimento" (input type="date"), "Multa (%)",
 * "Mora ao mês (%)", "Carência (dias)" e "Observações internas" (textarea). O botão "Criar contrato" passa os
 * campos por `toCreateLoanRequest`, chama `onSubmit` com o resultado e mostra "Contrato criado em rascunho." num
 * elemento role="status". Se a conversão lançar erro, não chama `onSubmit` e mostra "Confira os campos do
 * contrato." num elemento role="alert".
 */
export function NewLoanForm({ people, defaults, onSubmit }: NewLoanFormProps): JSX.Element {
  const { register, handleSubmit } = useForm<NewLoanFormValues>({ defaultValues: newLoanFormDefaults(defaults) });
  const [outcome, setOutcome] = useState<Outcome>("idle");

  const submit = (values: NewLoanFormValues): void => {
    try {
      const request = toCreateLoanRequest(values);
      onSubmit?.(request);
      setOutcome("ok");
    } catch {
      setOutcome("error");
    }
  };

  return (
    <div>
      <form onSubmit={(event) => void handleSubmit(submit)(event)} noValidate>
        <label>
          Cliente
          <select {...register("personId")}>
            <option value="">Selecione</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.fullName}
              </option>
            ))}
          </select>
        </label>
        <label>
          Valor emprestado
          <input type="text" {...register("amount")} />
        </label>
        <label>
          Taxa ao mês (%)
          <input type="text" {...register("monthlyRate")} />
        </label>
        <label>
          Nº de parcelas
          <input type="text" {...register("installmentCount")} />
        </label>
        <label>
          Periodicidade
          <select {...register("frequency")}>
            {frequencies.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          1º vencimento
          <input type="date" {...register("firstDueDate")} />
        </label>
        <label>
          Multa (%)
          <input type="text" {...register("lateFee")} />
        </label>
        <label>
          Mora ao mês (%)
          <input type="text" {...register("lateInterest")} />
        </label>
        <label>
          Carência (dias)
          <input type="text" {...register("gracePeriodDays")} />
        </label>
        <label>
          Observações internas
          <textarea {...register("internalNotes")} />
        </label>
        <button type="submit">Criar contrato</button>
      </form>
      {outcome === "ok" ? <p role="status">Contrato criado em rascunho.</p> : null}
      {outcome === "error" ? <p role="alert">Confira os campos do contrato.</p> : null}
    </div>
  );
}
