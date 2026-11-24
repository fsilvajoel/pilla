import { and, asc, eq, gt, gte, lt, lte, or, sql, type SQL } from "drizzle-orm";
import type { Database } from "../../db/database";
import { sumCents } from "./account-balances";
import { accounts, ledgerEntries, type LedgerEntryRow } from "./schema";

export type StatementEntryRow = Omit<LedgerEntryRow, "sourceEventId" | "createdBy" | "idempotencyKey"> & {
  readonly balanceAfterCents: number;
};

export type StatementPageParams = {
  readonly accountId: string;
  readonly from: string | null;
  readonly to: string | null;
  readonly limit: number;
  readonly afterId: string | null;
};

export async function accountExists(db: Database, accountId: string): Promise<boolean> {
  const rows = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.id, accountId));
  return rows.length > 0;
}

export async function ledgerEntryExists(db: Database, accountId: string, entryId: string): Promise<boolean> {
  const rows = await db
    .select({ id: ledgerEntries.id })
    .from(ledgerEntries)
    .where(and(eq(ledgerEntries.id, entryId), eq(ledgerEntries.accountId, accountId)));
  return rows.length > 0;
}

/** Saldo da conta até a data (inclusive) ou o saldo atual sem data. */
export async function balanceUpTo(db: Database, accountId: string, to: string | null): Promise<number> {
  const rows = await db
    .select({ total: sumCents })
    .from(ledgerEntries)
    .where(and(eq(ledgerEntries.accountId, accountId), to === null ? undefined : lte(ledgerEntries.entryDate, to)));
  return rows.reduce((sum, row) => sum + row.total, 0);
}

/** Saldo da conta antes da data (exclusive). */
export async function balanceBefore(db: Database, accountId: string, date: string): Promise<number> {
  const rows = await db
    .select({ total: sumCents })
    .from(ledgerEntries)
    .where(and(eq(ledgerEntries.accountId, accountId), lt(ledgerEntries.entryDate, date)));
  return rows.reduce((sum, row) => sum + row.total, 0);
}

/**
 * Lançamentos do período em ordem entry_date, created_at, id, com o saldo acumulado calculado pelo banco numa janela
 * sobre a conta inteira (por isso `from` e o cursor filtram depois da soma). Lê `limit + 1` linhas para saber se há
 * próxima página; a posição do cursor sai do próprio banco, sem perder a precisão do instante.
 */
export async function selectStatementPage(db: Database, params: StatementPageParams): Promise<StatementEntryRow[]> {
  const order = sql`${ledgerEntries.entryDate}, ${ledgerEntries.createdAt}, ${ledgerEntries.id}`;
  const ranked = db.$with("ranked").as(
    db
      .select({
        id: ledgerEntries.id,
        accountId: ledgerEntries.accountId,
        type: ledgerEntries.type,
        amountCents: ledgerEntries.amountCents,
        component: ledgerEntries.component,
        sourceType: ledgerEntries.sourceType,
        sourceId: ledgerEntries.sourceId,
        entryDate: ledgerEntries.entryDate,
        justification: ledgerEntries.justification,
        createdAt: ledgerEntries.createdAt,
        balanceAfterCents: sql<number>`(sum(${ledgerEntries.amountCents}) over (order by ${order}))::bigint`
          .mapWith(Number)
          .as("balance_after_cents"),
      })
      .from(ledgerEntries)
      .where(
        and(
          eq(ledgerEntries.accountId, params.accountId),
          params.to === null ? undefined : lte(ledgerEntries.entryDate, params.to),
        ),
      ),
  );
  const conditions: (SQL | undefined)[] = [params.from === null ? undefined : gte(ranked.entryDate, params.from)];
  if (params.afterId !== null) {
    const id = params.afterId;
    const anchor = (column: "entryDate" | "createdAt") =>
      db.select({ value: ledgerEntries[column] }).from(ledgerEntries).where(eq(ledgerEntries.id, id));
    conditions.push(
      or(
        gt(ranked.entryDate, anchor("entryDate")),
        and(eq(ranked.entryDate, anchor("entryDate")), gt(ranked.createdAt, anchor("createdAt"))),
        and(eq(ranked.entryDate, anchor("entryDate")), eq(ranked.createdAt, anchor("createdAt")), gt(ranked.id, id)),
      ),
    );
  }
  return db
    .with(ranked)
    .select()
    .from(ranked)
    .where(and(...conditions))
    .orderBy(asc(ranked.entryDate), asc(ranked.createdAt), asc(ranked.id))
    .limit(params.limit + 1);
}
