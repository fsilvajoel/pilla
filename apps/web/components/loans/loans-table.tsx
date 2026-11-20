import type { LoanListItem } from "@pilla/schemas";
import type { ReactElement } from "react";
import Link from "next/link";
import { cents, formatReais } from "@pilla/finance";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { loanStandingLabel, loanStatusLabel } from "@/lib/labels";
import { formatDateBr } from "./loan-actions";

const money = (value: number): string => `R$ ${formatReais(cents(BigInt(value)))}`;

const columns: readonly DataTableColumn<LoanListItem>[] = [
  {
    key: "number",
    header: "Contrato",
    cell: (l) => (
      <Link href={`/emprestimos/${l.id}`} className="text-primary font-medium hover:underline">
        {l.loanNumber}
      </Link>
    ),
  },
  { key: "person", header: "Cliente", cell: (l) => l.personName },
  { key: "principal", header: "Valor emprestado", cell: (l) => money(l.principalCents) },
  { key: "outstanding", header: "Saldo devedor", cell: (l) => money(l.outstandingCents) },
  { key: "next", header: "Próximo vencimento", cell: (l) => (l.nextDueDate ? formatDateBr(l.nextDueDate) : "—") },
  {
    key: "status",
    header: "Situação",
    cell: (l) => {
      const overdue = l.status === "ACTIVE" && l.standing === "OVERDUE";
      return (
        <Badge variant={overdue ? "destructive" : l.status === "ACTIVE" ? "success" : "secondary"}>
          {l.status === "ACTIVE" && l.standing ? loanStandingLabel[l.standing] : loanStatusLabel[l.status]}
        </Badge>
      );
    },
  },
];

export type LoansTableProps = { readonly loans: readonly LoanListItem[] };

export function LoansTable({ loans }: LoansTableProps): ReactElement {
  return <DataTable columns={columns} rows={loans} getRowKey={(l) => l.id} emptyText="Nenhum contrato." />;
}
