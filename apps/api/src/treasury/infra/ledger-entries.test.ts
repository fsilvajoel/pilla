import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { columnsOf, indexesOf, insertRow, testIds } from "../../db/table-contract";
import { migratedTestDb } from "../../db/test-db";

// Contrato da tabela em SQL (RFC-005 §6): livro-caixa só acrescenta, valor com sinal e consumidor idempotente.
describe("treasury.ledger_entries (RFC-005 §6)", () => {
  let client: PGlite;
  const id = testIds();
  let accountId = "";
  const add = (fields: Record<string, unknown> = {}) =>
    insertRow<{
      amount_cents: number;
      component: string | null;
      justification: string | null;
      created_at: Date | null;
    }>(client, "treasury.ledger_entries", {
      id: id(),
      account_id: accountId,
      type: "CAPITAL_IN",
      amount_cents: 100000,
      entry_date: "2026-11-16",
      created_by: id(),
      ...fields,
    });
  beforeAll(async () => {
    ({ client } = await migratedTestDb());
    accountId = id();
    await insertRow(client, "treasury.accounts", { id: accountId, name: "Conta principal" });
  });
  afterAll(async () => client.close());

  it("has exactly the columns of RFC-005 §6", async () => {
    expect(await columnsOf(client, "treasury", "ledger_entries")).toEqual([
      "account_id uuid not null",
      "amount_cents bigint not null",
      "component text null",
      "created_at timestamp with time zone not null default now()",
      "created_by uuid not null",
      "entry_date date not null",
      "id uuid not null",
      "justification text null",
      "source_event_id uuid null",
      "source_id uuid null",
      "source_type text null",
      "type text not null",
    ]);
  });

  it("keeps the sign of amount_cents and fills created_at", async () => {
    const { rows } = await add({ type: "CAPITAL_OUT", amount_cents: -2500 });
    expect(rows[0]?.amount_cents).toBe(-2500);
    expect(rows[0]?.created_at).toBeInstanceOf(Date);
  });

  it("refuses amount_cents 0", async () => {
    await expect(add({ amount_cents: 0 })).rejects.toThrow(/check constraint/);
  });

  it.each([
    ["type", "TRANSFER"],
    ["component", "FEES"],
    ["source_type", "PERSON"],
  ])("refuses %s %s", async (field, value) => {
    await expect(add({ [field]: value })).rejects.toThrow(/check constraint/);
  });

  it.each([null, "", "   "])("refuses an ADJUSTMENT with justification %j", async (justification) => {
    await expect(add({ type: "ADJUSTMENT", justification })).rejects.toThrow(/check constraint/);
  });

  it("accepts an ADJUSTMENT with a justification", async () => {
    const { rows } = await add({ type: "ADJUSTMENT", amount_cents: -1, justification: "acerto de arredondamento" });
    expect(rows[0]?.justification).toBe("acerto de arredondamento");
  });

  it("refuses the same source event twice for the same component", async () => {
    const event = { source_event_id: id(), component: "PRINCIPAL", type: "REPAYMENT", source_type: "PAYMENT" };
    await add(event);
    const { rows } = await add({ ...event, component: "INTEREST" });
    expect(rows[0]?.component).toBe("INTEREST");
    await expect(add(event)).rejects.toThrow(/unique constraint/);
  });

  it("refuses an account that does not exist", async () => {
    await expect(add({ account_id: "01970000-0000-7000-8000-ffffffffffff" })).rejects.toThrow(/foreign key constraint/);
  });

  it("has the indexes of RFC-005 §6", async () => {
    expect(await indexesOf(client, "treasury", "ledger_entries")).toEqual([
      "CREATE INDEX ledger_entries_account_id_entry_date_idx ON treasury.ledger_entries USING btree (account_id, entry_date)",
      "CREATE UNIQUE INDEX ledger_entries_pkey ON treasury.ledger_entries USING btree (id)",
      "CREATE UNIQUE INDEX ledger_entries_source_event_id_component_key ON treasury.ledger_entries USING btree (source_event_id, component)",
      "CREATE INDEX ledger_entries_source_type_source_id_idx ON treasury.ledger_entries USING btree (source_type, source_id)",
    ]);
  });
});
