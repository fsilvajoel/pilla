"use client";

import { useState, useTransition, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { DefaultTermsResponse, PersonSummary } from "@pilla/schemas";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { newLoanFormDefaults, toCreateLoanRequest, type NewLoanFormValues } from "@/lib/new-loan";
import type { LoanActionResult } from "./loan-actions";

export type NewLoanFormProps = {
  readonly people: readonly PersonSummary[];
  readonly defaults: DefaultTermsResponse;
  readonly onCreate: (input: unknown) => Promise<LoanActionResult>;
};

const FREQUENCIES: readonly { readonly value: NewLoanFormValues["frequency"]; readonly label: string }[] = [
  { value: "WEEKLY", label: "Semanal" },
  { value: "BIWEEKLY", label: "Quinzenal" },
  { value: "MONTHLY", label: "Mensal" },
  { value: "BIMONTHLY", label: "Bimestral" },
];

const selectClass = "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm";

function errorProp(message: string | undefined): { error?: string } {
  return message === undefined ? {} : { error: message };
}

/** Novo contrato (RF-11, RF-41): encargos vêm do padrão da API; grava por Server Action e abre o detalhe. */
export function NewLoanForm({ people, defaults, onCreate }: NewLoanFormProps): ReactElement {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<NewLoanFormValues>({ defaultValues: newLoanFormDefaults(defaults) });

  function onValid(values: NewLoanFormValues): void {
    setFormError(null);
    let request: unknown;
    try {
      request = toCreateLoanRequest(values);
    } catch {
      setFormError("Confira os campos do contrato.");
      return;
    }
    startTransition(async () => {
      const result = await onCreate(request);
      if (result.ok) {
        toast.success("Contrato criado em rascunho.");
        if (result.activeLoansCount !== undefined && result.activeLoansCount > 0) {
          toast.warning(`Esta pessoa já tem ${String(result.activeLoansCount)} contrato(s) em andamento.`);
        }
        router.push(`/emprestimos/${result.id}`);
        return;
      }
      setFormError(result.message);
    });
  }

  return (
    <form
      noValidate
      className="flex max-w-xl flex-col gap-4"
      onSubmit={(event) => {
        void handleSubmit(onValid)(event);
      }}
    >
      <FormField id="personId" label="Cliente" {...errorProp(errors.personId?.message)}>
        <select className={selectClass} {...register("personId")}>
          <option value="">Selecione</option>
          {people.map((person) => (
            <option key={person.id} value={person.id}>
              {person.fullName}
            </option>
          ))}
        </select>
      </FormField>
      <FormField id="amount" label="Valor emprestado">
        <Input type="text" inputMode="decimal" {...register("amount")} />
      </FormField>
      <FormField id="monthlyRate" label="Taxa ao mês (%)">
        <Input type="text" inputMode="decimal" {...register("monthlyRate")} />
      </FormField>
      <FormField id="installmentCount" label="Nº de parcelas">
        <Input type="text" inputMode="numeric" {...register("installmentCount")} />
      </FormField>
      <FormField id="frequency" label="Periodicidade">
        <select className={selectClass} {...register("frequency")}>
          {FREQUENCIES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </FormField>
      <FormField id="firstDueDate" label="1º vencimento">
        <Input type="date" {...register("firstDueDate")} />
      </FormField>
      <FormField id="lateFee" label="Multa (%)">
        <Input type="text" inputMode="decimal" {...register("lateFee")} />
      </FormField>
      <FormField id="lateInterest" label="Mora ao mês (%)">
        <Input type="text" inputMode="decimal" {...register("lateInterest")} />
      </FormField>
      <FormField id="gracePeriodDays" label="Carência (dias)">
        <Input type="text" inputMode="numeric" {...register("gracePeriodDays")} />
      </FormField>
      <FormField id="internalNotes" label="Observações internas">
        <Textarea {...register("internalNotes")} />
      </FormField>
      {formError && (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Criando…" : "Criar contrato"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            router.back();
          }}
        >
          Voltar
        </Button>
      </div>
    </form>
  );
}
