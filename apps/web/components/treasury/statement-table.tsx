import type { AccountStatementEntry } from "@pilla/schemas";
import type { ReactElement } from "react";
import { formatDateBr } from "@/components/loans/loan-actions";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { ledgerComponentLabel, ledgerEntryTypeLabel } from "@/lib/labels";
import { formatMoney } from "./treasury-format";

export type StatementTableProps = { readonly entries: readonly AccountStatementEntry[] };

const columns: readonly DataTableColumn<AccountStatementEntry>[] = [
  { key: "date", header: "Data", cell: (e) => formatDateBr(e.entryDate) },
  { key: "type", header: "Tipo", cell: (e) => ledgerEntryTypeLabel[e.type] },
  {
    key: "component",
    header: "Componente",
    cell: (e) => (e.component === null ? "—" : ledgerComponentLabel[e.component]),
  },
  {
    key: "amount",
    header: "Valor",
    cell: (e) => (
      <span className={e.amountCents < 0 ? "text-destructive" : undefined}>{formatMoney(e.amountCents)}</span>
    ),
  },
  { key: "balance", header: "Saldo após", cell: (e) => formatMoney(e.balanceAfterCents) },
  { key: "justification", header: "Justificativa", cell: (e) => e.justification ?? "—" },
];

/** Extrato da conta base (RF-31): valor negativo em vermelho com sinal e saldo após cada lançamento. */
export function StatementTable({ entries }: StatementTableProps): ReactElement {
  return (
    <DataTable columns={columns} rows={entries} getRowKey={(e) => e.id} emptyText="Nenhum lançamento no período." />
  );
}
