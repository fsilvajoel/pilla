// @stub E7-T10

import type { LoanDetailResponse } from "@pilla/schemas";
import type { JSX } from "react";

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
export function LoanDetail({ loan: _loan }: LoanDetailProps): JSX.Element {
  throw new Error("not implemented");
}
