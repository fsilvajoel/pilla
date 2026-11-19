"use client";

import { useForm } from "react-hook-form";
import { useState } from "react";
import { createPersonRequest, type CreatePersonRequest, type PersonSummary } from "@pilla/schemas";
import type { JSX } from "react";

export interface PersonFormProps {
  /** pessoas já cadastradas, opções do "Indicado por" (RF-03) */
  readonly people: readonly PersonSummary[];
  /** recebe o corpo validado de POST /people; sem API ainda (dados de mentira, decisões do Joel de 17/11) */
  readonly onSubmit?: (request: CreatePersonRequest) => void;
}

/** Campos como o ADMIN digita; texto vazio = campo opcional ausente. */
export interface PersonFormValues {
  readonly fullName: string;
  /** só números, ex.: "52998224725" */
  readonly cpf: string;
  /** E.164, ex.: "+5511987654321" */
  readonly phone: string;
  readonly email: string;
  /** "AAAA-MM-DD" (input type="text") */
  readonly birthDate: string;
  /** id de uma pessoa de `people`, ou "" */
  readonly referredById: string;
  readonly notes: string;
}

/**
 * Cadastro de pessoa do ADMIN (PRD-001 RF-01 e RF-03). Formulário React Hook Form com `PersonFormValues`, cada
 * campo com rótulo: "Nome completo", "CPF", "Telefone", "E-mail", "Nascimento" (input type="text"), "Indicado
 * por" (select com a opção value "" e texto "Ninguém", depois uma opção por pessoa de `people`, value = id e
 * texto = fullName) e "Observações" (textarea). O botão "Cadastrar" monta o corpo deixando de fora os opcionais
 * vazios (email, birthDate, referredById, notes), valida com `createPersonRequest.parse` de `@pilla/schemas`,
 * chama `onSubmit` com o resultado e mostra "Pessoa cadastrada." num elemento role="status". Se a validação
 * lançar erro, não chama `onSubmit` e mostra "Confira os campos do cadastro." num elemento role="alert".
 */
export function PersonForm({ people, onSubmit }: PersonFormProps): JSX.Element {
  const { register, handleSubmit } = useForm<PersonFormValues>({
    defaultValues: {
      fullName: "",
      cpf: "",
      phone: "",
      email: "",
      birthDate: "",
      referredById: "",
      notes: "",
    },
  });

  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle");

  const onValid = (data: PersonFormValues) => {
    const requestData: Partial<Record<keyof PersonFormValues, string>> = {
      fullName: data.fullName,
      cpf: data.cpf,
      phone: data.phone,
    };

    // Opcionais vazios ficam de fora do corpo; o conteúdo é validado pelo schema
    // (ex.: observação só com espaços falha no trim().min(1)).
    if (data.email !== "") {
      requestData.email = data.email;
    }
    if (data.birthDate !== "") {
      requestData.birthDate = data.birthDate;
    }
    if (data.referredById !== "") {
      requestData.referredById = data.referredById;
    }
    if (data.notes !== "") {
      requestData.notes = data.notes;
    }

    try {
      const parsed = createPersonRequest.parse(requestData);
      onSubmit?.(parsed);
      setSubmitStatus("success");
    } catch {
      setSubmitStatus("error");
    }
  };

  return (
    <form
      noValidate
      onSubmit={(e) => {
        void handleSubmit(onValid)(e);
      }}
    >
      <div>
        <label htmlFor="fullName">Nome completo</label>
        <input id="fullName" type="text" {...register("fullName")} />
      </div>

      <div>
        <label htmlFor="cpf">CPF</label>
        <input id="cpf" type="text" {...register("cpf")} />
      </div>

      <div>
        <label htmlFor="phone">Telefone</label>
        <input id="phone" type="text" {...register("phone")} />
      </div>

      <div>
        <label htmlFor="email">E-mail</label>
        <input id="email" type="text" {...register("email")} />
      </div>

      <div>
        <label htmlFor="birthDate">Nascimento</label>
        <input id="birthDate" type="text" {...register("birthDate")} />
      </div>

      <div>
        <label htmlFor="referredById">Indicado por</label>
        <select id="referredById" {...register("referredById")}>
          <option value="">Ninguém</option>
          {people.map((person) => (
            <option key={person.id} value={person.id}>
              {person.fullName}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="notes">Observações</label>
        <textarea id="notes" {...register("notes")} />
      </div>

      <button type="submit">Cadastrar</button>

      {submitStatus === "success" && <div role="status">Pessoa cadastrada.</div>}

      {submitStatus === "error" && <div role="alert">Confira os campos do cadastro.</div>}
    </form>
  );
}
