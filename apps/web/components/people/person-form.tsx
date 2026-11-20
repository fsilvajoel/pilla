"use client";

import { useState, useTransition, type ChangeEvent, type SyntheticEvent, type ReactElement } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { cpfSchema, isoDateSchema, phoneSchema, type PersonDetailResponse, type PersonSummary } from "@pilla/schemas";
import { toast } from "sonner";
import {
  createPersonAction,
  updatePersonAction,
  type PersonActionFailure,
  type PersonPayload,
} from "@/app/(admin)/pessoas/actions";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatCpf, formatPhone } from "./format";
import { ReferrerSearch } from "./referrer-search";

export interface PersonFormProps {
  /** Ficha a editar; ausente = criação. */
  person?: PersonDetailResponse;
}

type FormValues = {
  fullName: string;
  cpf: string;
  phone: string;
  email: string;
  birthDate: string;
  notes: string;
};

function digits(value: string): string {
  return value.replace(/\D/g, "");
}

/** "(11) 98765-4321" -> "+5511987654321". */
function toE164(phone: string): string {
  const d = digits(phone);
  return d.startsWith("55") && d.length > 11 ? `+${d}` : `+55${d}`;
}

/** "31/12/1990" -> "1990-12-31" (vazio ou incompleto devolve ""). */
function toIsoDate(value: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  return m ? `${String(m[3])}-${String(m[2])}-${String(m[1])}` : "";
}

function fromIsoDate(iso: string | undefined): string {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso) : null;
  return m ? `${String(m[3])}/${String(m[2])}/${String(m[1])}` : "";
}

function maskDate(value: string): string {
  const d = digits(value).slice(0, 8);
  if (d.length > 4) return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
  if (d.length > 2) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return d;
}

const formSchema = z.object({
  fullName: z.string().trim().min(1, "Informe o nome completo.").max(150, "Máximo de 150 caracteres."),
  cpf: z.string().refine((v) => cpfSchema.safeParse(digits(v)).success, "CPF inválido."),
  phone: z.string().refine((v) => phoneSchema.safeParse(toE164(v)).success, "Telefone inválido."),
  email: z.string().refine((v) => v === "" || z.email().max(254).safeParse(v).success, "E-mail inválido."),
  birthDate: z.string().refine((v) => v === "" || isoDateSchema.safeParse(toIsoDate(v)).success, "Data inválida."),
  notes: z.string().max(2000, "Máximo de 2000 caracteres."),
});

function toPayload(values: FormValues, referrer: PersonSummary | null): PersonPayload {
  const email = values.email.trim();
  const birthDate = toIsoDate(values.birthDate);
  const notes = values.notes.trim();
  return {
    fullName: values.fullName.trim(),
    cpf: digits(values.cpf),
    phone: toE164(values.phone),
    ...(email ? { email } : {}),
    ...(birthDate ? { birthDate } : {}),
    ...(referrer ? { referredById: referrer.id } : {}),
    ...(notes ? { notes } : {}),
  };
}

function errorProps(message: string | undefined): { error?: string } {
  return message ? { error: message } : {};
}

export function PersonForm({ person }: PersonFormProps): ReactElement {
  const [pending, startTransition] = useTransition();
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [referrer, setReferrer] = useState<PersonSummary | null>(person?.referrer ?? null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: "onBlur",
    defaultValues: {
      fullName: person?.fullName ?? "",
      cpf: person ? formatCpf(person.cpf) : "",
      phone: person ? formatPhone(person.phone.replace(/^\+55/, "")) : "",
      email: person?.email ?? "",
      birthDate: fromIsoDate(person?.birthDate),
      notes: person?.notes ?? "",
    },
  });

  const submit = (values: FormValues): void => {
    setServerErrors({});
    const payload = toPayload(values, referrer);
    startTransition(async () => {
      try {
        const result: PersonActionFailure = person
          ? await updatePersonAction(person.id, person.version, payload)
          : await createPersonAction(payload);
        setServerErrors(result.fieldErrors);
        toast.error(result.message);
      } catch {
        // redirect() do Next sai por exceção: a navegação segue sozinha.
      }
    });
  };

  const onSubmit = (event: SyntheticEvent<HTMLFormElement>): void => {
    void handleSubmit(submit)(event);
  };

  const cpf = register("cpf");
  const phone = register("phone");
  const birthDate = register("birthDate");

  const fieldError = (name: keyof FormValues): string | undefined => errors[name]?.message ?? serverErrors[name];

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-6">
      <FormField id="fullName" label="Nome completo" {...errorProps(fieldError("fullName"))}>
        <Input {...register("fullName")} autoComplete="off" disabled={pending} />
      </FormField>

      <FormField id="cpf" label="CPF" {...errorProps(fieldError("cpf"))}>
        <Input
          {...cpf}
          inputMode="numeric"
          placeholder="000.000.000-00"
          maxLength={14}
          disabled={pending}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            setValue("cpf", formatCpf(e.target.value), { shouldDirty: true });
          }}
        />
      </FormField>

      <FormField id="phone" label="Telefone" {...errorProps(fieldError("phone"))}>
        <Input
          {...phone}
          inputMode="tel"
          placeholder="(00) 00000-0000"
          maxLength={15}
          disabled={pending}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            setValue("phone", formatPhone(e.target.value), { shouldDirty: true });
          }}
        />
      </FormField>

      <FormField id="email" label="E-mail (opcional)" {...errorProps(fieldError("email"))}>
        <Input {...register("email")} type="email" placeholder="email@exemplo.com" disabled={pending} />
      </FormField>

      <FormField
        id="birthDate"
        label="Nascimento (opcional)"
        description="Formato DD/MM/AAAA"
        {...errorProps(fieldError("birthDate"))}
      >
        <Input
          {...birthDate}
          inputMode="numeric"
          placeholder="DD/MM/AAAA"
          maxLength={10}
          disabled={pending}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            setValue("birthDate", maskDate(e.target.value), { shouldDirty: true });
          }}
        />
      </FormField>

      <ReferrerSearch
        value={referrer}
        onChange={setReferrer}
        disabled={pending}
        {...(person ? { excludeId: person.id } : {})}
      />

      <FormField id="notes" label="Observações (opcional)" {...errorProps(fieldError("notes"))}>
        <Textarea {...register("notes")} rows={4} disabled={pending} />
      </FormField>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : person ? "Salvar alterações" : "Cadastrar pessoa"}
        </Button>
      </div>
    </form>
  );
}
