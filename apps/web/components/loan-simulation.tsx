"use client";
// @stub E6-T06

import type { IsoDate } from "@pilla/finance";
import type { JSX } from "react";

export interface LoanSimulationProps {
  /** data do desembolso usada no cálculo (RFC-002: o relógio vem de fora) */
  readonly disbursementDate: IsoDate;
}

/**
 * Tela de simulação do ADMIN (PRD-001 RF-10, esboço `docs/prd/telas/simulacao-contrato.png`), sem gravar e sem
 * chamar a API (ADR-0013). Formulário React Hook Form com os campos de `SimulationFormValues`, cada um com
 * rótulo: "Valor emprestado", "Taxa ao mês (%)", "Nº de parcelas", "Periodicidade" (select cujas opções têm
 * value WEEKLY, BIWEEKLY, MONTHLY, BIMONTHLY e texto Semanal, Quinzenal, Mensal, Bimestral) e "1º vencimento"
 * (input type="date"). O botão "Simular" passa os campos por `toSimulateRequest` e `simulate` e mostra "Total a
 * receber" e "Juros" como "R$ " + `formatReais`, "Parcela" como "6 × R$ 1.150,00" e a tabela Nº, Vencimento
 * (dd/mm/aaaa), Principal, Juros, Parcela, com células em `formatReais` sem "R$". Se a conversão ou o cálculo
 * lançar erro, mostra um alerta (role="alert") "Confira os campos da simulação." no lugar do resultado.
 */
export function LoanSimulation({ disbursementDate: _disbursementDate }: LoanSimulationProps): JSX.Element {
  throw new Error("not implemented");
}
