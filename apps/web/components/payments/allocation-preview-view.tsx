import type { AllocationPreviewResponse } from "@pilla/schemas";
import type { ReactElement } from "react";
import { cents, formatReais } from "@pilla/finance";
import { formatDateBr } from "@/components/loans/loan-actions";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";

type Allocation = AllocationPreviewResponse["allocations"][number];

const plain = (value: number): string => formatReais(cents(BigInt(value)));
const money = (value: number): string => `R$ ${plain(value)}`;

const columns: readonly DataTableColumn<Allocation>[] = [
  { key: "number", header: "Parcela", cell: (a) => a.installmentNumber },
  { key: "due", header: "Vencimento", cell: (a) => formatDateBr(a.dueDate) },
  { key: "charges", header: "Encargos", cell: (a) => plain(a.lateChargesCents) },
  { key: "interest", header: "Juros", cell: (a) => plain(a.interestCents) },
  { key: "principal", header: "Principal", cell: (a) => plain(a.principalCents) },
  {
    key: "after",
    header: "Situação depois",
    cell: (a) => (
      <Badge variant={a.installmentStatusAfter === "PAID" ? "success" : "secondary"}>
        {a.installmentStatusAfter === "PAID" ? "Paga" : "Parcial"}
      </Badge>
    ),
  },
];

/** Prévia da alocação do pagamento por parcela (RF-23); em DRAFT só avisa que a distribuição vem na confirmação. */
export function AllocationPreviewView({ preview }: { readonly preview: AllocationPreviewResponse }): ReactElement {
  if (preview.deferred) {
    return (
      <section aria-label="Prévia da alocação" className="rounded-lg border p-4 text-sm">
        A distribuição entre parcelas, juros e encargos é calculada na confirmação, depois que o contrato for ativado.
      </section>
    );
  }
  return (
    <section aria-label="Prévia da alocação" className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Prévia da alocação</h2>
      <DataTable
        columns={columns}
        rows={preview.allocations}
        getRowKey={(a) => String(a.installmentNumber)}
        emptyText="Sem parcelas afetadas."
      />
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <div>
          <dt className="text-sm text-muted-foreground">Encargos</dt>
          <dd className="font-medium">{money(preview.totals.lateChargesCents)}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Juros</dt>
          <dd className="font-medium">{money(preview.totals.interestCents)}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Principal</dt>
          <dd className="font-medium">{money(preview.totals.principalCents)}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Saldo depois</dt>
          <dd className="font-medium">
            {preview.outstandingAfterCents === null ? "—" : money(preview.outstandingAfterCents)}
          </dd>
        </div>
        {preview.paysOff && (
          <div>
            <dt className="text-sm text-muted-foreground">Efeito</dt>
            <dd className="font-medium">Quita o contrato</dd>
          </div>
        )}
      </dl>
      {preview.isRecovery && (
        <p className="text-sm text-muted-foreground">Contrato baixado como perda: o valor entra como recuperação.</p>
      )}
    </section>
  );
}
