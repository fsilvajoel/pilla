"use client";

import { useState, useTransition, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { PersonSummary } from "@pilla/schemas";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { PersonActionResult } from "@/lib/people-action-result";
import {
  checkCreateRequest,
  checkUpdateRequest,
  emptyPersonFormValues,
  toCreateBody,
  toUpdateBody,
  type PersonFormValues,
} from "./person-form-request";
import { ReferrerPicker } from "./referrer-picker";

const FIELDS = Object.keys(emptyPersonFormValues).filter(isField);

function isField(name: string): name is keyof PersonFormValues {
  return name in emptyPersonFormValues;
}

function errorProp(message: string | undefined): { error?: string } {
  return message === undefined ? {} : { error: message };
}

export type PersonFormProps = {
  /** "create": cadastro com indicador; "edit": edição com controle de versão (indicador não muda). */
  mode: "create" | "edit";
  initialValues?: PersonFormValues;
  /** pessoa já indicadora (somente leitura na edição, escolhível no cadastro) */
  referrer?: PersonSummary | null;
  /** só na edição */
  personId?: string;
  version?: number;
  onCreate?: (input: unknown) => Promise<PersonActionResult>;
  onUpdate?: (id: string, input: unknown) => Promise<PersonActionResult>;
  onSearch: (term: string) => Promise<readonly PersonSummary[]>;
};

/** Formulário de pessoa (RF-01, RF-03): valida com os schemas da API e grava por Server Action. */
export function PersonForm(props: PersonFormProps): ReactElement {
  const { mode, personId, version } = props;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [referrer, setReferrer] = useState<PersonSummary | null>(props.referrer ?? null);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<PersonFormValues>({ defaultValues: props.initialValues ?? emptyPersonFormValues });

  function showFieldErrors(fieldErrors: Readonly<Record<string, string>>): void {
    for (const [field, message] of Object.entries(fieldErrors)) {
      const key = FIELDS.find((name) => name === field);
      if (key) setError(key, { message });
    }
  }

  function onValid(raw: PersonFormValues): void {
    setFormError(null);
    const values: PersonFormValues = { ...raw, referredById: referrer?.id ?? "" };
    const isEdit = mode === "edit" && personId !== undefined && version !== undefined;
    const body = isEdit ? toUpdateBody(values, version) : toCreateBody(values);
    const check = isEdit ? checkUpdateRequest(body) : checkCreateRequest(body);
    if (!check.ok) {
      showFieldErrors(check.fieldErrors);
      setFormError("Confira os campos do cadastro.");
      return;
    }
    startTransition(async () => {
      const result = isEdit ? await props.onUpdate?.(personId, body) : await props.onCreate?.(body);
      if (!result) return;
      if (result.ok) {
        toast.success(isEdit ? "Pessoa atualizada." : "Pessoa cadastrada.");
        router.push(`/pessoas/${result.id}`);
        return;
      }
      showFieldErrors(result.fieldErrors);
      if (result.code === "DUPLICATE_CPF") {
        setError("cpf", { message: result.message });
      } else if (result.code === "VERSION_CONFLICT") {
        toast.error("Esta pessoa foi alterada por outra pessoa. Recarregue a página e tente de novo.");
      } else {
        setFormError(result.message);
      }
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
      <FormField id="fullName" label="Nome completo" {...errorProp(errors.fullName?.message)}>
        <Input type="text" autoComplete="off" {...register("fullName")} />
      </FormField>
      <FormField id="cpf" label="CPF" {...errorProp(errors.cpf?.message)}>
        <Input type="text" inputMode="numeric" placeholder="000.000.000-00" {...register("cpf")} />
      </FormField>
      <FormField id="phone" label="Telefone" {...errorProp(errors.phone?.message)} description="Ex.: +5511987654321">
        <Input type="tel" {...register("phone")} />
      </FormField>
      <FormField id="email" label="E-mail" {...errorProp(errors.email?.message)}>
        <Input type="email" {...register("email")} />
      </FormField>
      <FormField id="birthDate" label="Nascimento" {...errorProp(errors.birthDate?.message)} description="AAAA-MM-DD">
        <Input type="text" placeholder="1990-01-31" {...register("birthDate")} />
      </FormField>
      {mode === "create" ? (
        <ReferrerPicker selected={referrer} onSelect={setReferrer} search={props.onSearch} />
      ) : (
        referrer && (
          <p className="text-sm text-muted-foreground">Indicado por {referrer.fullName} (não muda após o cadastro).</p>
        )
      )}
      <FormField id="notes" label="Observações" {...errorProp(errors.notes?.message)}>
        <Textarea {...register("notes")} />
      </FormField>
      {formError && (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando…" : mode === "create" ? "Cadastrar" : "Salvar"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            router.back();
          }}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
