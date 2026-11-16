import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { columnsOf, indexesOf, insertRow, testIds } from "../../db/table-contract";
import { migratedTestDb } from "../../db/test-db";

// Contrato da tabela em SQL (RFC-005 §7): uma linha por pessoa; habilitado sempre diz quando e por quem.
describe("access.portal_access (RFC-005 §7)", () => {
  let client: PGlite;
  const id = testIds();
  let adminUserId = "";
  const add = (fields: Record<string, unknown> = {}) =>
    insertRow<{ enabled: boolean; version: number; created_at: Date | null }>(client, "access.portal_access", {
      person_id: id(),
      enabled: true,
      enabled_at: "2026-11-16T12:00:00Z",
      enabled_by: adminUserId,
      ...fields,
    });
  beforeAll(async () => {
    ({ client } = await migratedTestDb());
    adminUserId = id();
    await insertRow(client, "access.admin_users", {
      id: adminUserId,
      username: "admin",
      password_hash: "$argon2id$teste",
    });
  });
  afterAll(async () => client.close());

  it("has exactly the columns of RFC-005 §7", async () => {
    expect(await columnsOf(client, "access", "portal_access")).toEqual([
      "created_at timestamp with time zone not null default now()",
      "enabled boolean not null",
      "enabled_at timestamp with time zone null",
      "enabled_by uuid null",
      "person_id uuid not null",
      "updated_at timestamp with time zone not null default now()",
      "version integer not null default 1",
    ]);
  });

  it("stores an enabled access at version 1", async () => {
    const { rows } = await add();
    expect(rows[0]?.enabled).toBe(true);
    expect(rows[0]?.version).toBe(1);
    expect(rows[0]?.created_at).toBeInstanceOf(Date);
  });

  it("stores a disabled access without enabled_at and enabled_by", async () => {
    const { rows } = await add({ enabled: false, enabled_at: null, enabled_by: null });
    expect(rows[0]?.enabled).toBe(false);
  });

  it.each(["enabled_at", "enabled_by"])("refuses an enabled access without %s", async (field) => {
    await expect(add({ [field]: null })).rejects.toThrow(/check constraint/);
  });

  it("refuses a second row for the same person", async () => {
    const personId = id();
    await add({ person_id: personId });
    await expect(add({ person_id: personId })).rejects.toThrow(/duplicate key/);
  });

  it("refuses an admin user that does not exist", async () => {
    await expect(add({ enabled_by: "01970000-0000-7000-8000-ffffffffffff" })).rejects.toThrow(/foreign key constraint/);
  });

  it("has the indexes of RFC-005 §7", async () => {
    expect(await indexesOf(client, "access", "portal_access")).toEqual([
      "CREATE INDEX portal_access_enabled_by_idx ON access.portal_access USING btree (enabled_by)",
      "CREATE UNIQUE INDEX portal_access_pkey ON access.portal_access USING btree (person_id)",
    ]);
  });
});
