import { isoDateSchema } from "@pilla/schemas";
import type { ReactElement } from "react";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { EntryDialog } from "@/components/treasury/entry-dialog";
import { StatementFilters } from "@/components/treasury/statement-filters";
import { StatementTable } from "@/components/treasury/statement-table";
import { SummaryCards } from "@/components/treasury/summary-cards";
import { formatMoney } from "@/components/treasury/treasury-format";
import { formatDateBr } from "@/components/loans/loan-actions";
import { getAccountStatement, getTreasurySummary, listAccounts, type AccountStatementParams } from "@/lib/api/treasury";
import { todayInBrt } from "@/lib/today";
import { createEntryAction } from "./actions";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const PAGE_SIZE = 20;

function first(value: string | string[] | undefined): string {
  const single = Array.isArray(value) ? value[0] : value;
  return single?.trim() ?? "";
}

function validDate(text: string): string {
  return isoDateSchema.safeParse(text).success ? text : "";
}

/** Tesouraria (RF-30 a RF-32): painel do mês no topo e extrato da conta base; filtros e cursor ficam na URL. */
export default async function CaixaPage({ searchParams }: PageProps): Promise<ReactElement> {
  const raw = await searchParams;
  const rawMonth = first(raw.month);
  const month = MONTH.test(rawMonth) && rawMonth >= "2000-01" ? rawMonth : undefined;
  const from = validDate(first(raw.from));
  const to = validDate(first(raw.to));
  const cursor = first(raw.cursor);
  const rangeError = from !== "" && to !== "" && from > to ? "A data inicial não pode ser depois da final." : undefined;

  const summary = await getTreasurySummary(month);
  const accounts = await listAccounts();
  const account = accounts.items.find((item) => item.active);
  if (account === undefined) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Caixa" />
        <EmptyState text="Nenhuma conta ativa cadastrada." />
      </div>
    );
  }

  const params: AccountStatementParams = { limit: PAGE_SIZE };
  if (rangeError === undefined) {
    if (from !== "") params.from = from;
    if (to !== "") params.to = to;
  }
  if (cursor !== "") params.cursor = cursor;
  const statement = await getAccountStatement(account.id, params);

  const next = new URLSearchParams({ month: summary.month });
  if (from !== "") next.set("from", from);
  if (to !== "") next.set("to", to);
  if (statement.nextCursor !== null) next.set("cursor", statement.nextCursor);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Caixa"
        description={`Conta: ${account.name}`}
        actions={<EntryDialog accountId={account.id} today={todayInBrt(new Date())} onSubmit={createEntryAction} />}
      />
      <StatementFilters month={summary.month} from={from} to={to} {...(rangeError ? { error: rangeError } : {})} />
      <SummaryCards summary={summary} />
      <section aria-label="Extrato" className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Extrato</h2>
        <p className="text-sm text-muted-foreground">
          {from !== "" || to !== ""
            ? `Período: ${from === "" ? "início" : formatDateBr(from)} a ${to === "" ? "hoje" : formatDateBr(to)}. `
            : ""}
          Saldo inicial: {formatMoney(statement.openingBalanceCents)}. Saldo final:{" "}
          {formatMoney(statement.closingBalanceCents)}.
        </p>
        <StatementTable entries={statement.items} />
        {statement.nextCursor !== null && (
          <div className="flex justify-center">
            <Button variant="outline" asChild>
              <Link href={`/caixa?${next.toString()}`}>Carregar mais</Link>
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
