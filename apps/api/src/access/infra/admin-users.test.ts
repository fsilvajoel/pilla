import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { columnsOf, indexesOf, insertRow, testIds } from "../../db/table-contract";
import { migratedTestDb } from "../../db/test-db";

// Contrato da tabela em SQL (RFC-005 §7, ADR-0011): administrador com usuário único.
describe("access.admin_users (RFC-005 §7)", () => {
  let client: PGlite;
  const id = testIds();
  const add = (fields: Record<string, unknown> = {}) =>
    insertRow<{ active: boolean; version: number; last_login_at: Date | null; created_at: Date | null }>(
      client,
      "access.admin_users",
      { id: id(), username: `admin-${id()}`, password_hash: "$argon2id$teste", ...fields },
    );
  beforeAll(async () => ({ client } = await migratedTestDb()));
  afterAll(async () => client.close());

  it("has exactly the columns of RFC-005 §7", async () => {
    expect(await columnsOf(client, "access", "admin_users")).toEqual([
      "active boolean not null default true",
      "created_at timestamp with time zone not null default now()",
      "id uuid not null",
      "last_login_at timestamp with time zone null",
      "password_hash text not null",
      "updated_at timestamp with time zone not null default now()",
      "username text not null",
      "version integer not null default 1",
    ]);
  });

  it("starts active, at version 1, never logged in", async () => {
    const { rows } = await add();
    expect(rows[0]?.active).toBe(true);
    expect(rows[0]?.version).toBe(1);
    expect(rows[0]?.last_login_at).toBeNull();
    expect(rows[0]?.created_at).toBeInstanceOf(Date);
  });

  it("refuses a repeated username", async () => {
    await add({ username: "joel" });
    await expect(add({ username: "joel" })).rejects.toThrow(/unique constraint/);
  });

  it("has the indexes of RFC-005 §7", async () => {
    expect(await indexesOf(client, "access", "admin_users")).toEqual([
      "CREATE UNIQUE INDEX admin_users_pkey ON access.admin_users USING btree (id)",
      "CREATE UNIQUE INDEX admin_users_username_unique ON access.admin_users USING btree (username)",
    ]);
  });
});
