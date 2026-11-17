import type { LoanDetailResponse } from "@pilla/schemas";
import type { JSX } from "react";
import Link from "next/link";
import { cents, formatReais } from "@pilla/finance";
import { installmentStatusLabel, loanStandingLabel, loanStatusLabel } from "@/lib/labels";

export interface LoanDetailProps {
  /** resposta de GET /loans/{id} (dados de mentira, decisões do Joel de 17/11) */
  readonly loan: LoanDetailResponse;
}

/**
 * Detalhe do contrato com parcelas (PRD-001 RF-18). Título (h1) "Contrato " + `loanNumber`, o `personName` e a
 * situação: `loanStatusLabel[status]` e, quando há `standing`, também `loanStandingLabel[standing]`
 * (`@/lib/labels`). Resumo em pares termo/valor (dl, dt, dd): "Valor emprestado" (principalCents), "Juros"
 * (interestCents, a soma dos juros das parcelas), "Total" (totalCents), "Pago" (paidCents) e "Saldo devedor"
 * (outstandingCents), todos "R$ " + `formatReais` de `@pilla/finance`. Tabela de parcelas com as colunas Nº,
 * Vencimento (dd/mm/aaaa), Parcela, Pago, Encargos (as três em `formatReais` sem "R$") e Situação
 * (`installmentStatusLabel[status]`), uma linha por parcela (key = number). Só quando o status é ACTIVE, um link
 * "Registrar pagamento" (`Link` de next/link) para "/emprestimos/" + id + "/pagamento".
 */
export function LoanDetail({ loan }: LoanDetailProps): JSX.Element {
  const formatCurrency = (value: number): string => {
    return formatReais(cents(BigInt(value)));
  };

  const formatDate = (dateStr: string): string => {
    const parts = dateStr.split("-");
    return parts.reverse().join("/");
  };

  const summaryItems = [
    { label: "Valor emprestado", value: loan.principalCents },
    { label: "Juros", value: loan.interestCents },
    { label: "Total", value: loan.totalCents },
    { label: "Pago", value: loan.paidCents },
    { label: "Saldo devedor", value: loan.outstandingCents },
  ] as const;

  return (
    <section>
      <h1>Contrato {loan.loanNumber}</h1>
      <p>{loan.personName}</p>
      <p>
        Situação: {loanStatusLabel[loan.status]}
        {loan.standing && ` - ${loanStandingLabel[loan.standing]}`}
      </p>
      <dl>
        {summaryItems.map((item) => (
          <div key={item.label}>
            <dt>{item.label}</dt>
            <dd>R$ {formatCurrency(item.value)}</dd>
          </div>
        ))}
      </dl>
      {loan.status === "ACTIVE" && (
        <p>
          <Link href={`/emprestimos/${loan.id}/pagamento`}>Registrar pagamento</Link>
        </p>
      )}
      <table>
        <thead>
          <tr>
            <th>Nº</th>
            <th>Vencimento</th>
            <th>Parcela</th>
            <th>Pago</th>
            <th>Encargos</th>
            <th>Situação</th>
          </tr>
        </thead>
        <tbody>
          {loan.installments.map((installment) => (
            <tr key={installment.number}>
              <td>{installment.number}</td>
              <td>{formatDate(installment.dueDate)}</td>
              <td>{formatCurrency(installment.totalCents)}</td>
              <td>{formatCurrency(installment.paidCents)}</td>
              <td>{formatCurrency(installment.lateChargesCents)}</td>
              <td>{installmentStatusLabel[installment.status]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
