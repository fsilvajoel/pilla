"use client";
// @stub E7-T03

import type { CreatePersonRequest, PersonSummary } from "@pilla/schemas";
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
  /** "AAAA-MM-DD" (input type="date") */
  readonly birthDate: string;
  /** id de uma pessoa de `people`, ou "" */
  readonly referredById: string;
  readonly notes: string;
}

/**
 * Cadastro de pessoa do ADMIN (PRD-001 RF-01 e RF-03). Formulário React Hook Form com `PersonFormValues`, cada
 * campo com rótulo: "Nome completo", "CPF", "Telefone", "E-mail", "Nascimento" (input type="date"), "Indicado
 * por" (select com a opção value "" e texto "Ninguém", depois uma opção por pessoa de `people`, value = id e
 * texto = fullName) e "Observações" (textarea). O botão "Cadastrar" monta o corpo deixando de fora os opcionais
 * vazios (email, birthDate, referredById, notes), valida com `createPersonRequest.parse` de `@pilla/schemas`,
 * chama `onSubmit` com o resultado e mostra "Pessoa cadastrada." num elemento role="status". Se a validação
 * lançar erro, não chama `onSubmit` e mostra "Confira os campos do cadastro." num elemento role="alert".
 */
export function PersonForm({ people: _people, onSubmit: _onSubmit }: PersonFormProps): JSX.Element {
  throw new Error("not implemented");
}
