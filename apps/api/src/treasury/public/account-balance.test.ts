import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { migratedTestDb, type MigratedTestDb } from "../../db/test-db";
import { accountBalanceCents, totalBalanceCents } from "./account-balance";

const uuid = (n: number): string => `01970000-0000-7000-8000-${String(1000000000000 + n).slice(1)}`;
const ACTIVE = uuid(1);
const INACTIVE = uuid(2);
const EMPTY = uuid(3);
const USER = uuid(4);

let handle: MigratedTestDb;
let client: PGlite;

beforeAll(async () => {
  handle = await migratedTestDb();
  client = handle.client;
});
afterAll(async () => {
  await handle.close();
});
beforeEach(async () => {
  await client.query("delete from treasury.ledger_entries");
  await client.query("delete from treasury.accounts");
  await client.query(
    "insert into treasury.accounts (id, name, active) values ($1, 'A', true), ($2, 'B', false), ($3, 'C', true)",
    [ACTIVE, INACTIVE, EMPTY],
  );
});

async function entry(n: number, accountId: string, amount: number): Promise<void> {
  await client.query(
    `insert into treasury.ledger_entries (id, account_id, type, amount_cents, entry_date, created_by)
     values ($1, $2, 'CAPITAL_IN', $3, '2026-01-10', $4)`,
    [uuid(100 + n), accountId, amount, USER],
  );
}

describe("account-balance public port (ADR-0005)", () => {
  it("accountBalanceCents sums the entries of one account, with sign, and gives 0 when empty", async () => {
    await entry(1, ACTIVE, 1000);
    await entry(2, ACTIVE, -250);
    await entry(3, INACTIVE, 7000);
    expect(await accountBalanceCents(handle.db, ACTIVE)).toBe(750);
    expect(await accountBalanceCents(handle.db, EMPTY)).toBe(0);
  });

  it("totalBalanceCents sums only the active accounts and gives 0 without entries", async () => {
    expect(await totalBalanceCents(handle.db)).toBe(0);
    await entry(1, ACTIVE, 1000);
    await entry(2, INACTIVE, 7000);
    expect(await totalBalanceCents(handle.db)).toBe(1000);
  });
});
