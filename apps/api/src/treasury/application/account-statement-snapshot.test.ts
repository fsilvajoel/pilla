import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { migratedTestDb, type MigratedTestDb } from "../../db/test-db";
import { accountStatement } from "./account-statement";

// D6 (E12-F03): abertura, fechamento e página saem de um snapshot só (transação REPEATABLE READ). O PGlite tem uma
// conexão só e não deixa gravar no meio da transação, então o teste confere o contrato: tudo dentro de uma
// transação com o isolamento certo, e o resultado continua coerente.
const ACCOUNT = "01970000-0000-7000-8000-000000000002";
const USER = "01970000-0000-7000-8000-000000000003";

let handle: MigratedTestDb;

beforeAll(async () => {
  handle = await migratedTestDb();
  await handle.client.query("insert into treasury.accounts (id, name, active) values ($1, 'A', true)", [ACCOUNT]);
  await handle.client.query(
    `insert into treasury.ledger_entries (id, account_id, type, amount_cents, entry_date, created_by)
     values ('01970000-0000-7000-8000-000000000010', $1, 'CAPITAL_IN', 500, '2026-11-01', $2),
            ('01970000-0000-7000-8000-000000000011', $1, 'CAPITAL_IN', 300, '2026-11-05', $2)`,
    [ACCOUNT, USER],
  );
});
afterAll(async () => handle.close());

describe("accountStatement: snapshot consistente", () => {
  it("reads opening, closing and page inside one REPEATABLE READ transaction", async () => {
    const spy = vi.spyOn(handle.db, "transaction");
    const result = await accountStatement(handle.db, ACCOUNT, { from: "2026-11-02", limit: 10 });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]?.[1]).toEqual({ isolationLevel: "repeatable read" });
    expect(result.openingBalanceCents).toBe(500);
    expect(result.closingBalanceCents).toBe(800);
    expect(result.items.at(-1)?.balanceAfterCents).toBe(800);
    spy.mockRestore();
  });
});
