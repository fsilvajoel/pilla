import type { ReactElement } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type StatementFiltersProps = {
  readonly month: string;
  readonly from: string;
  readonly to: string;
  readonly error?: string;
};

/** Mês do painel e período do extrato: formulário GET, sem JavaScript no cliente. */
export function StatementFilters({ month, from, to, error }: StatementFiltersProps): ReactElement {
  return (
    <form method="get" className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Mês do painel
        <Input type="month" name="month" defaultValue={month} className="w-40" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Extrato de
        <Input type="date" name="from" defaultValue={from} className="w-40" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        até
        <Input type="date" name="to" defaultValue={to} className="w-40" />
      </label>
      <Button type="submit" variant="outline">
        Filtrar
      </Button>
      {error && (
        <p role="alert" className="w-full text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
