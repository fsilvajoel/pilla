import type { LoanDetailResponse } from "@pilla/schemas";
import type { ReactElement, ReactNode } from "react";
import Link from "next/link";
import { cents, formatReais } from "@pilla/finance";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { installmentStatusLabel, loanStandingLabel, loanStatusLabel } from "@/lib/labels";
import { acceptsPayment } from "@/components/payments/payment-actions";
import { canEdit, canRollover, formatDateBr } from "./loan-actions";

type Installment = LoanDetailResponse["installments"][number];

const plain = (value: number): string => formatReais(cents(BigInt(value)));
const money = (value: number): string => `R$ ${plain(value)}`;

const ROLLOVER_LINKS = [
  { path: "renovar", label: "Renovar" },
  { path: "renegociar", label: "Renegociar" },
  { path: "baixa", label: "Baixar como perda" },
  { path: "quitacao", label: "Cotação de quitação" },
] as const;

const columns: readonly DataTableColumn<Installment>[] = [
  { key: "number", header: "Nº", cell: (i) => i.number },
  { key: "due", header: "Vencimento", cell: (i) => formatDateBr(i.dueDate) },
  { key: "total", header: "Parcela", cell: (i) => plain(i.totalCents) },
  { key: "paid", header: "Pago", cell: (i) => plain(i.paidCents) },
  { key: "charges", header: "Encargos", cell: (i) => plain(i.lateChargesCents) },
  {
    key: "status",
    header: "Situação",
    cell: (i) => (
      <Badge variant={i.status === "PAID" ? "success" : i.status.startsWith("OVERDUE") ? "destructive" : "secondary"}>
        {installmentStatusLabel[i.status]}
      </Badge>
    ),
  },
];

export type LoanDetailViewProps = { readonly loan: LoanDetailResponse; readonly children?: ReactNode };

/** Detalhe do contrato (RF-18); `children` recebe as ações do rascunho. */
export function LoanDetailView({ loan, children }: LoanDetailViewProps): ReactElement {
  const summary = [
    { label: "Valor emprestado", value: loan.principalCents },
    { label: "Juros", value: loan.interestCents },
    { label: "Total", value: loan.totalCents },
    { label: "Pago", value: loan.paidCents },
    { label: "Saldo devedor", value: loan.outstandingCents },
  ] as const;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Contrato ${loan.loanNumber}`}
        description={`${loan.personName} · ${loanStatusLabel[loan.status]}${loan.standing ? ` · ${loanStandingLabel[loan.standing]}` : ""}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {canEdit(loan.status) && (
              <Button asChild variant="outline">
                <Link href={`/emprestimos/${loan.id}/editar`}>Editar</Link>
              </Button>
            )}
            {acceptsPayment(loan.status) && (
              <Button asChild>
                <Link href={`/emprestimos/${loan.id}/pagamento`}>Registrar pagamento</Link>
              </Button>
            )}
            <Button asChild variant="outline">
              <Link href={`/pagamentos?loanId=${loan.id}`}>Pagamentos do contrato</Link>
            </Button>
            {canRollover(loan.status) &&
              ROLLOVER_LINKS.map((item) => (
                <Button key={item.path} asChild variant="outline">
                  <Link href={`/emprestimos/${loan.id}/${item.path}`}>{item.label}</Link>
                </Button>
              ))}
          </div>
        }
      />
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        {summary.map((item) => (
          <div key={item.label}>
            <dt className="text-sm text-muted-foreground">{item.label}</dt>
            <dd className="font-medium">{money(item.value)}</dd>
          </div>
        ))}
      </dl>
      {children}
      <DataTable
        columns={columns}
        rows={loan.installments}
        getRowKey={(i) => String(i.number)}
        emptyText="Sem parcelas."
      />
    </div>
  );
}
