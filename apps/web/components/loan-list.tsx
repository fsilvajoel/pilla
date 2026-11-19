import type { LoanListItem } from "@pilla/schemas";
import type { JSX } from "react";
import { cents, formatReais } from "@pilla/finance";
import Link from "next/link";
import { loanStandingLabel, loanStatusLabel } from "@/lib/labels";

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
export function LoanList({ loans }: LoanListProps): JSX.Element {
  return (
    <>
      <Link href="/emprestimos/novo">Novo contrato</Link>
      {loans.length === 0 ? (
        <p>Nenhum contrato.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Contrato</th>
              <th>Cliente</th>
              <th>Valor emprestado</th>
              <th>Saldo devedor</th>
              <th>Próximo vencimento</th>
              <th>Situação</th>
            </tr>
          </thead>
          <tbody>
            {loans.map((loan) => (
              <tr key={loan.id}>
                <td>
                  <Link href={`/emprestimos/${loan.id}`}>{loan.loanNumber}</Link>
                </td>
                <td>{loan.personName}</td>
                <td>R$ {formatReais(cents(BigInt(loan.principalCents)))}</td>
                <td>R$ {formatReais(cents(BigInt(loan.outstandingCents)))}</td>
                <td>{loan.nextDueDate ? loan.nextDueDate.split("-").reverse().join("/") : "—"}</td>
                <td>
                  {loan.status === "ACTIVE" && loan.standing
                    ? loanStandingLabel[loan.standing]
                    : loanStatusLabel[loan.status]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
