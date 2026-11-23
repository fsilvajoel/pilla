import { eq, sql } from "drizzle-orm";
import type { Database } from "../../db/database";
import { accounts, ledgerEntries } from "./schema";

/** Soma com sinal, nunca nula: o saldo é sempre derivado do ledger (ADR-0005). */
export const sumCents = sql<number>`coalesce(sum(${ledgerEntries.amountCents}), 0)::bigint`.mapWith(Number);

/** Soma dos saldos das contas ativas. */
export async function activeBalanceTotal(db: Database): Promise<number> {
  const rows = await db
    .select({ total: sumCents })
    .from(ledgerEntries)
    .innerJoin(accounts, eq(accounts.id, ledgerEntries.accountId))
    .where(eq(accounts.active, true));
  return rows.reduce((sum, row) => sum + row.total, 0);
}
