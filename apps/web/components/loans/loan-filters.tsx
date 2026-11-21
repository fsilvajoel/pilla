import type { ReactElement } from "react";
import type { LoanStanding, LoanStatus } from "@pilla/schemas";
import { Button } from "@/components/ui/button";
import { loanStandingLabel, loanStatusLabel } from "@/lib/labels";

export type LoanFiltersProps = { readonly status?: LoanStatus; readonly standing?: LoanStanding };

const selectClass = "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm";

/** Filtros por status e situação: formulário GET, sem JavaScript no cliente. */
export function LoanFilters({ status, standing }: LoanFiltersProps): ReactElement {
  return (
    <form method="get" className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Status
        <select name="status" defaultValue={status ?? ""} className={selectClass}>
          <option value="">Todos</option>
          {Object.entries(loanStatusLabel).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Situação
        <select name="standing" defaultValue={standing ?? ""} className={selectClass}>
          <option value="">Todas</option>
          {Object.entries(loanStandingLabel).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <Button type="submit" variant="outline">
        Filtrar
      </Button>
    </form>
  );
}
