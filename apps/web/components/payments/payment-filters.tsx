import type { PaymentStatus } from "@pilla/schemas";
import type { ReactElement } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { paymentStatusLabel } from "@/lib/labels";

export type PaymentFiltersProps = { readonly status: PaymentStatus; readonly loanId?: string };

const selectClass = "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm";

/** Filtros por situação e por contrato: formulário GET, sem JavaScript no cliente. */
export function PaymentFilters({ status, loanId }: PaymentFiltersProps): ReactElement {
  return (
    <form method="get" className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Situação
        <select name="status" defaultValue={status} className={selectClass}>
          {Object.entries(paymentStatusLabel).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Contrato (id)
        <Input name="loanId" defaultValue={loanId ?? ""} placeholder="Todos os contratos" className="w-80" />
      </label>
      <Button type="submit" variant="outline">
        Filtrar
      </Button>
      {loanId !== undefined && (
        <Button asChild variant="ghost">
          <Link href={`/pagamentos?status=${status}`}>Todos os contratos</Link>
        </Button>
      )}
    </form>
  );
}
