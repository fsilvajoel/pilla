import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import type { Database } from "../../db/database";
import { sumCents } from "./account-balances";
import { accounts, ledgerEntries } from "./schema";

export type MonthLedgerTotals = {
  readonly interestCents: number;
  readonly lateChargesCents: number;
  readonly recoveredCents: number;
};

/** REPAYMENT mais REVERSAL (ambos com sinal) por componente, com `entry_date` no mês. */
export async function monthLedgerTotals(
  db: Database,
  monthStart: string,
  monthEnd: string,
): Promise<MonthLedgerTotals> {
  const rows = await db
    .select({ component: ledgerEntries.component, total: sumCents })
    .from(ledgerEntries)
    .where(
      and(
        inArray(ledgerEntries.type, ["REPAYMENT", "REVERSAL"]),
        gte(ledgerEntries.entryDate, monthStart),
        lte(ledgerEntries.entryDate, monthEnd),
      ),
    )
    .groupBy(ledgerEntries.component);
  const totalOf = (component: string): number => rows.find((row) => row.component === component)?.total ?? 0;
  return {
    interestCents: totalOf("INTEREST"),
    lateChargesCents: totalOf("LATE_CHARGES"),
    recoveredCents: totalOf("RECOVERY"),
  };
}

/** Teto de capital comprometido da conta base (a primeira conta ativa); nulo sem conta ou sem teto. */
export async function baseAccountMaxCommittedBps(db: Database): Promise<number | null> {
  const rows = await db
    .select({ maxCommittedBps: accounts.maxCommittedBps })
    .from(accounts)
    .where(eq(accounts.active, true))
    .orderBy(asc(accounts.createdAt), asc(accounts.id))
    .limit(1);
  return rows[0]?.maxCommittedBps ?? null;
}
