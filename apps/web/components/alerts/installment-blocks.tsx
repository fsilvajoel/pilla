import type { DueInstallmentItem, OverdueInstallmentItem } from "@pilla/schemas";
import type { ReactElement } from "react";
import Link from "next/link";
import { cents, formatReais } from "@pilla/finance";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge, type StatusBadgeMap } from "@/components/shared/status-badge";
import { formatDateBr } from "@/components/loans/loan-actions";
import { installmentStatusLabel } from "@/lib/labels";

const money = (value: number): string => `R$ ${formatReais(cents(BigInt(value)))}`;

type InstallmentStatus = DueInstallmentItem["status"] | OverdueInstallmentItem["status"];

const statusMap: StatusBadgeMap<InstallmentStatus> = {
  OPEN: { label: installmentStatusLabel.OPEN, variant: "secondary" },
  PARTIAL: { label: installmentStatusLabel.PARTIAL, variant: "warning" },
  OVERDUE: { label: installmentStatusLabel.OVERDUE, variant: "destructive" },
  OVERDUE_PARTIAL: { label: installmentStatusLabel.OVERDUE_PARTIAL, variant: "destructive" },
};

type Row = DueInstallmentItem | OverdueInstallmentItem;

const statusColumn: DataTableColumn<Row> = {
  key: "status",
  header: "Situação",
  cell: (r) => <StatusBadge status={r.status} map={statusMap} />,
};

const baseColumns: readonly DataTableColumn<Row>[] = [
  { key: "person", header: "Pessoa", cell: (r) => r.personName },
  {
    key: "loan",
    header: "Contrato",
    cell: (r) => (
      <Link href={`/emprestimos/${r.loanId}`} className="text-primary font-medium hover:underline">
        {r.loanNumber}
      </Link>
    ),
  },
  { key: "installment", header: "Parcela", cell: (r) => String(r.installmentNumber) },
  { key: "due", header: "Vencimento", cell: (r) => formatDateBr(r.dueDate) },
  { key: "open", header: "Em aberto", cell: (r) => money(r.openCents) },
  statusColumn,
];

const overdueColumns: readonly DataTableColumn<OverdueInstallmentItem>[] = [
  ...baseColumns.filter((c) => c.key !== "status"),
  {
    key: "days",
    header: "Atraso",
    cell: (r) => `${String(r.daysOverdue)} ${r.daysOverdue === 1 ? "dia" : "dias"} de atraso`,
  },
  { key: "charges", header: "Encargos", cell: (r) => money(r.lateChargesCents) },
  { key: "total", header: "Total a pagar", cell: (r) => money(r.totalDueCents) },
  statusColumn,
];

type BlockProps<T extends Row> = {
  readonly title: string;
  readonly emptyText: string;
  readonly count: number;
  readonly totalCents: number;
  readonly items: readonly T[];
  readonly columns: readonly DataTableColumn<T>[];
};

function InstallmentBlock<T extends Row>({
  title,
  emptyText,
  count,
  totalCents,
  items,
  columns,
}: BlockProps<T>): ReactElement {
  const headingId = `alertas-${title.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h2 id={headingId} className="text-lg font-semibold">
        {title} ({String(count)}) · {money(totalCents)}
      </h2>
      {items.length === 0 ? (
        <EmptyState text={emptyText} />
      ) : (
        <DataTable
          columns={columns}
          rows={items}
          getRowKey={(r) => `${r.loanId}-${String(r.installmentNumber)}`}
          emptyText={emptyText}
        />
      )}
    </section>
  );
}

type Block<T> = { readonly count: number; readonly totalCents: number; readonly items: readonly T[] };

export type InstallmentBlocksProps = {
  readonly dueToday: Block<DueInstallmentItem>;
  readonly dueThisWeek: Block<DueInstallmentItem>;
  readonly overdue: Block<OverdueInstallmentItem>;
};

export function InstallmentBlocks({ dueToday, dueThisWeek, overdue }: InstallmentBlocksProps): ReactElement {
  return (
    <div className="flex flex-col gap-8">
      <InstallmentBlock
        title="Vencendo hoje"
        emptyText="Nenhuma parcela vencendo hoje."
        columns={baseColumns}
        {...dueToday}
      />
      <InstallmentBlock
        title="Vencendo na semana"
        emptyText="Nenhuma parcela vencendo na semana."
        columns={baseColumns}
        {...dueThisWeek}
      />
      <InstallmentBlock title="Atrasadas" emptyText="Nenhuma parcela atrasada." columns={overdueColumns} {...overdue} />
    </div>
  );
}
