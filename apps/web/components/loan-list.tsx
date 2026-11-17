// @stub E7-T09

import type { LoanListItem } from "@pilla/schemas";
import type { JSX } from "react";

export interface LoanListProps {
  /** itens de GET /loans (dados de mentira, decisões do Joel de 17/11) */
  readonly loans: readonly LoanListItem[];
}

/**
 * Lista de contratos do ADMIN (decisões do Joel de 17/11). No topo, um link "Novo contrato" para
 * "/emprestimos/novo" (`Link` de next/link). Depois, uma tabela com as colunas Contrato, Cliente, Valor
 * emprestado, Saldo devedor, Próximo vencimento e Situação, uma linha por contrato (key = id): Contrato é um link
 * com o texto `loanNumber` para "/emprestimos/" + id; os valores são "R$ " + `formatReais` de `@pilla/finance`;
 * o vencimento é dd/mm/aaaa, ou "—" quando nulo; Situação é `loanStandingLabel[standing]` quando o status é
 * ACTIVE, senão `loanStatusLabel[status]` (`@/lib/labels`). Sem contratos, no lugar da tabela, o texto
 * "Nenhum contrato.".
 */
export function LoanList({ loans: _loans }: LoanListProps): JSX.Element {
  throw new Error("not implemented");
}
