import type { PendingReviewItem } from "@pilla/schemas";
import type { ReactElement } from "react";
import Link from "next/link";
import { cents, formatReais } from "@pilla/finance";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { formatDateBr } from "@/components/loans/loan-actions";
import { paymentMethodLabel } from "@/lib/labels";

const money = (value: number): string => `R$ ${formatReais(cents(BigInt(value)))}`;

const brasiliaDate = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" });

/** Data (Brasília) em que o pagamento foi registrado. */
const formatInstantDate = (instant: string): string => brasiliaDate.format(new Date(instant));

const columns: readonly DataTableColumn<PendingReviewItem>[] = [
  { key: "person", header: "Pessoa", cell: (r) => r.personName },
  {
    key: "loan",
    header: "Contrato",
    cell: (r) => (
      <span className="flex flex-wrap items-center gap-2">
        <Link href={`/emprestimos/${r.loanId}`} className="text-primary font-medium hover:underline">
          {r.loanNumber}
        </Link>
        {r.loanStatus === "DRAFT" ? <Badge variant="warning">Contrato em rascunho</Badge> : null}
      </span>
    ),
  },
  { key: "amount", header: "Valor", cell: (r) => money(r.amountCents) },
  { key: "paidAt", header: "Pagamento", cell: (r) => formatDateBr(r.paidAt) },
  { key: "method", header: "Forma", cell: (r) => paymentMethodLabel[r.method] },
  { key: "createdAt", header: "Registrado em", cell: (r) => formatInstantDate(r.createdAt) },
];

export type PendingReviewBlockProps = {
  readonly count: number;
  readonly totalCents: number;
  readonly items: readonly PendingReviewItem[];
};

const emptyText = "Nenhum pagamento aguardando conferência.";

/** Pagamentos PENDING_REVIEW (RF-50); a conferência fica nas telas do contrato. */
export function PendingReviewBlock({ count, totalCents, items }: PendingReviewBlockProps): ReactElement {
  return (
    <section aria-labelledby="alertas-pendentes" className="flex flex-col gap-3">
      <h2 id="alertas-pendentes" className="text-lg font-semibold">
        Pagamentos pendentes de conferência ({String(count)}) · {money(totalCents)}
      </h2>
      {items.length === 0 ? (
        <EmptyState text={emptyText} />
      ) : (
        <DataTable columns={columns} rows={items} getRowKey={(r) => r.paymentId} emptyText={emptyText} />
      )}
    </section>
  );
}
