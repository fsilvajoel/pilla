"use client";

import { useState, useTransition, type ReactElement } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { DefaultTermsResponse } from "@pilla/schemas";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FIELD_OF_API, toFormValues, toUpdateRequest, type DefaultTermsFormValues } from "./default-terms-values";

export type SettingsActionResult =
  | { readonly ok: true; readonly terms: DefaultTermsResponse }
  | {
      readonly ok: false;
      readonly message: string;
      readonly fieldErrors: Readonly<Record<string, string>>;
    };

export type DefaultTermsFormProps = {
  readonly terms: DefaultTermsResponse;
  readonly onSave: (input: unknown) => Promise<SettingsActionResult>;
};

const FIELDS: readonly (keyof DefaultTermsFormValues)[] = [
  "lateFee",
  "lateInterest",
  "gracePeriodDays",
  "suggestedRate",
  "roundingStep",
];

function errorProp(message: string | undefined): { error?: string } {
  return message === undefined ? {} : { error: message };
}

/** Parâmetros padrão (RF-40): % e R$ viram bps e centavos sem ponto flutuante; grava por Server Action. */
export function DefaultTermsForm({ terms, onSave }: DefaultTermsFormProps): ReactElement {
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<DefaultTermsFormValues>({ defaultValues: toFormValues(terms) });

  function onValid(values: DefaultTermsFormValues): void {
    setFormError(null);
    setSaved(false);
    clearErrors();
    const parsed = toUpdateRequest(values);
    if (!parsed.ok) {
      for (const field of FIELDS) {
        const message = parsed.fieldErrors[field];
        if (message !== undefined) setError(field, { message });
      }
      return;
    }
    startTransition(async () => {
      const result = await onSave(parsed.data);
      if (result.ok) {
        reset(toFormValues(result.terms));
        setSaved(true);
        toast.success("Parâmetros atualizados.");
        return;
      }
      let placed = false;
      for (const [apiField, message] of Object.entries(result.fieldErrors)) {
        const field = FIELD_OF_API[apiField];
        if (field !== undefined) {
          setError(field, { message });
          placed = true;
        }
      }
      if (!placed) setFormError(result.message);
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
      <FormField id="lateFee" label="Multa por atraso (%)" {...errorProp(errors.lateFee?.message)}>
        <Input type="text" inputMode="decimal" {...register("lateFee")} />
      </FormField>
      <FormField id="lateInterest" label="Juros de mora (% ao mês)" {...errorProp(errors.lateInterest?.message)}>
        <Input type="text" inputMode="decimal" {...register("lateInterest")} />
      </FormField>
      <FormField id="gracePeriodDays" label="Carência (dias)" {...errorProp(errors.gracePeriodDays?.message)}>
        <Input type="text" inputMode="numeric" {...register("gracePeriodDays")} />
      </FormField>
      <FormField
        id="suggestedRate"
        label="Taxa de juros sugerida (% ao mês)"
        {...errorProp(errors.suggestedRate?.message)}
      >
        <Input type="text" inputMode="decimal" {...register("suggestedRate")} />
      </FormField>
      <FormField id="roundingStep" label="Passo de arredondamento (R$)" {...errorProp(errors.roundingStep?.message)}>
        <Input type="text" inputMode="decimal" {...register("roundingStep")} />
      </FormField>
      {formError && (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      )}
      {saved && (
        <p role="status" className="text-sm text-muted-foreground">
          Parâmetros atualizados.
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        A mudança vale só para contratos criados daqui em diante; os contratos existentes mantêm os seus parâmetros.
      </p>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </form>
  );
}
