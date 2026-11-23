import { and, desc, eq } from "drizzle-orm";
import { sumCents } from "./account-balances";
import type { Database } from "../../db/database";
import { accounts, ledgerEntries } from "./schema";

/** Conta base ativa do MVP (PEND-01), com id fixo para o seed ser idempotente. */
export const BASE_ACCOUNT_ID = "00000000-0000-7000-8003-000000000001";
export const BASE_ACCOUNT_NAME = "Conta principal";

export type AccountSummaryRow = {
  readonly id: string;
  readonly name: string;
  readonly active: boolean;
  readonly balanceCents: number;
};

/** Cria a conta base se ainda não existir; pode rodar quantas vezes for preciso. */
export async function seedBaseAccount(db: Database): Promise<void> {
  await db.insert(accounts).values({ id: BASE_ACCOUNT_ID, name: BASE_ACCOUNT_NAME }).onConflictDoNothing();
}

/** Contas com as ativas primeiro; dentro de cada grupo, por nome. O saldo é a soma do ledger (ADR-0005); sem lançamentos, 0. */
export async function listAccounts(db: Database): Promise<AccountSummaryRow[]> {
  return db
    .select({ id: accounts.id, name: accounts.name, active: accounts.active, balanceCents: sumCents })
    .from(accounts)
    .leftJoin(ledgerEntries, eq(ledgerEntries.accountId, accounts.id))
    .groupBy(accounts.id)
    .orderBy(desc(accounts.active), accounts.name);
}

export async function isActiveAccountRow(db: Database, id: string): Promise<boolean> {
  const rows = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.id, id), eq(accounts.active, true)));
  return rows.length > 0;
}
