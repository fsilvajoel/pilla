import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { columnsOf, indexesOf, insertRow, testIds } from "../../db/table-contract";
import { migratedTestDb } from "../../db/test-db";

// Contrato da tabela em SQL (RFC-005 §6): conta de capital, editável (updated_at e version).
describe("treasury.accounts (RFC-005 §6)", () => {
  let client: PGlite;
  const id = testIds();
  const add = (fields: Record<string, unknown> = {}) =>
    insertRow<{
      active: boolean;
      version: number;
      max_committed_bps: number | null;
      created_at: Date | null;
      updated_at: Date | null;
    }>(client, "treasury.accounts", { id: id(), name: "Conta principal", ...fields });
  beforeAll(async () => ({ client } = await migratedTestDb()));
  afterAll(async () => client.close());

  it("has exactly the columns of RFC-005 §6", async () => {
    expect(await columnsOf(client, "treasury", "accounts")).toEqual([
      "active boolean not null default true",
      "created_at timestamp with time zone not null default now()",
      "description text null",
      "id uuid not null",
      "max_committed_bps integer null",
      "name text not null",
      "pix_key_id uuid null",
      "updated_at timestamp with time zone not null default now()",
      "version integer not null default 1",
    ]);
  });

  it("starts active, at version 1, with created_at and updated_at filled", async () => {
    const { rows } = await add();
    expect(rows[0]?.active).toBe(true);
    expect(rows[0]?.version).toBe(1);
    expect(rows[0]?.created_at).toBeInstanceOf(Date);
    expect(rows[0]?.updated_at).toBeInstanceOf(Date);
  });

  it.each([0, 10000])("accepts max_committed_bps %i", async (bps) => {
    const { rows } = await add({ max_committed_bps: bps });
    expect(rows[0]?.max_committed_bps).toBe(bps);
  });

  it.each([-1, 10001])("refuses max_committed_bps %i", async (bps) => {
    await expect(add({ max_committed_bps: bps })).rejects.toThrow(/check constraint/);
  });

  it("has the indexes of RFC-005 §6", async () => {
    expect(await indexesOf(client, "treasury", "accounts")).toEqual([
      "CREATE INDEX accounts_pix_key_id_idx ON treasury.accounts USING btree (pix_key_id)",
      "CREATE UNIQUE INDEX accounts_pkey ON treasury.accounts USING btree (id)",
    ]);
  });
});
