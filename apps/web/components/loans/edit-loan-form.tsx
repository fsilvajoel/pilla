"use client";

import { useState, useTransition, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { LoanDetailResponse } from "@pilla/schemas";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { editLoanFormDefaults, toUpdateLoanRequest, type EditLoanFormValues } from "./edit-loan";
import type { LoanActionResult } from "./loan-actions";

export type EditLoanFormProps = {
  readonly loan: LoanDetailResponse;
  readonly onUpdate: (id: string, version: number, input: unknown) => Promise<LoanActionResult>;
};

const FREQUENCIES: readonly { readonly value: EditLoanFormValues["frequency"]; readonly label: string }[] = [
  { value: "WEEKLY", label: "Semanal" },
  { value: "BIWEEKLY", label: "Quinzenal" },
  { value: "MONTHLY", label: "Mensal" },
  { value: "BIMONTHLY", label: "Bimestral" },
];

const selectClass = "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm";

/** Edição do rascunho (E10-T21): PATCH parcial com `loan.version` em If-Match; volta ao detalhe ao salvar. */
export function EditLoanForm({ loan, onUpdate }: EditLoanFormProps): ReactElement {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Readonly<Record<string, string>>>({});
  const { register, handleSubmit } = useForm<EditLoanFormValues>({ defaultValues: editLoanFormDefaults(loan) });
  const single = loan.type === "SINGLE_PAYMENT";

  function err(name: string): { error?: string } {
    const message = fieldErrors[name];
    return message === undefined ? {} : { error: message };
  }

  function onValid(values: EditLoanFormValues): void {
    setFormError(null);
    setFieldErrors({});
    let request: unknown;
    try {
      request = toUpdateLoanRequest(values, loan.type);
    } catch {
      setFormError("Confira os campos do contrato.");
      return;
    }
    startTransition(async () => {
      const result = await onUpdate(loan.id, loan.version, request);
      if (result.ok) {
        toast.success("Rascunho atualizado.");
        router.push(`/emprestimos/${loan.id}`);
        router.refresh();
        return;
      }
      setFieldErrors(result.fieldErrors);
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
      <FormField id="amount" label="Valor emprestado" {...err("principalCents")}>
        <Input type="text" inputMode="decimal" {...register("amount")} />
      </FormField>
      <FormField id="monthlyRate" label="Taxa ao mês (%)" {...err("monthlyInterestRateBps")}>
        <Input type="text" inputMode="decimal" {...register("monthlyRate")} />
      </FormField>
      {!single && (
        <FormField id="installmentCount" label="Nº de parcelas" {...err("installmentCount")}>
          <Input type="text" inputMode="numeric" {...register("installmentCount")} />
        </FormField>
      )}
      <FormField id="frequency" label="Periodicidade" {...err("frequency")}>
        <select className={selectClass} {...register("frequency")}>
          {FREQUENCIES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </FormField>
      <FormField id="firstDueDate" label="1º vencimento" {...err("firstDueDate")}>
        <Input type="date" {...register("firstDueDate")} />
      </FormField>
      <FormField id="lateFee" label="Multa (%)" {...err("lateFeeBps")}>
        <Input type="text" inputMode="decimal" {...register("lateFee")} />
      </FormField>
      <FormField id="lateInterest" label="Mora ao mês (%)" {...err("lateInterestMonthlyBps")}>
        <Input type="text" inputMode="decimal" {...register("lateInterest")} />
      </FormField>
      <FormField id="gracePeriodDays" label="Carência (dias)" {...err("gracePeriodDays")}>
        <Input type="text" inputMode="numeric" {...register("gracePeriodDays")} />
      </FormField>
      <FormField id="internalNotes" label="Observações internas (vazio mantém as atuais)" {...err("internalNotes")}>
        <Textarea {...register("internalNotes")} />
      </FormField>
      {formError && (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando…" : "Salvar"}
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
