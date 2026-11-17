"use client";
// @stub E7-T07

import type { CreateLoanRequest, DefaultTermsResponse, PersonSummary } from "@pilla/schemas";
import type { JSX } from "react";

export interface NewLoanFormProps {
  /** opções do "Cliente" */
  readonly people: readonly PersonSummary[];
  /** parâmetros padrão (GET /settings/default-terms, RF-40) que preenchem o formulário (RF-41) */
  readonly defaults: DefaultTermsResponse;
  /** recebe o corpo validado de POST /loans; sem API ainda (dados de mentira, decisões do Joel de 17/11) */
  readonly onSubmit?: (request: CreateLoanRequest) => void;
}

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
export function NewLoanForm({
  people: _people,
  defaults: _defaults,
  onSubmit: _onSubmit,
}: NewLoanFormProps): JSX.Element {
  throw new Error("not implemented");
}
