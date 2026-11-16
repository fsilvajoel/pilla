import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { columnsOf, indexesOf, insertRow, testIds } from "../../db/table-contract";
import { migratedTestDb } from "../../db/test-db";

// Contrato da tabela em SQL (RFC-005 §7, ADR-0011): sessão no servidor, dona coerente com o papel.
describe("access.sessions (RFC-005 §7)", () => {
  let client: PGlite;
  const id = testIds();
  let adminUserId = "";
  let seq = 0;
  // Hash de teste: 64 caracteres hex, um diferente por sessão.
  const tokenHash = () => String(++seq).padStart(64, "0");
  const add = (fields: Record<string, unknown> = {}) =>
    insertRow<{ id: string; last_seen_at: Date | null; created_at: Date | null }>(client, "access.sessions", {
      id: tokenHash(),
      role: "ADMIN",
      admin_user_id: adminUserId,
      expires_at: "2026-11-17T00:00:00Z",
      ip: "203.0.113.7",
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
    expect(await columnsOf(client, "access", "sessions")).toEqual([
      "admin_user_id uuid null",
      "created_at timestamp with time zone not null default now()",
      "expires_at timestamp with time zone not null",
      "id character not null",
      "ip inet not null",
      "last_seen_at timestamp with time zone not null default now()",
      "person_id uuid null",
      "role text not null",
    ]);
  });

  it("stores an ADMIN session with created_at and last_seen_at filled", async () => {
    const { rows } = await add();
    expect(rows[0]?.created_at).toBeInstanceOf(Date);
    expect(rows[0]?.last_seen_at).toBeInstanceOf(Date);
  });

  it("stores a CLIENT session for a person", async () => {
    const hash = tokenHash();
    const { rows } = await add({ id: hash, role: "CLIENT", admin_user_id: null, person_id: id() });
    expect(rows[0]?.id).toBe(hash);
  });

  it.each([
    ["ADMIN without admin_user_id", { admin_user_id: null }],
    ["ADMIN with person_id", { person_id: "01970000-0000-7000-8000-aaaaaaaaaaaa" }],
    ["CLIENT without person_id", { role: "CLIENT", admin_user_id: null }],
    ["CLIENT with admin_user_id", { role: "CLIENT", person_id: "01970000-0000-7000-8000-aaaaaaaaaaaa" }],
    ["an unknown role", { role: "GUEST" }],
  ])("refuses %s", async (_, fields) => {
    await expect(add(fields)).rejects.toThrow(/check constraint/);
  });

  it("refuses an admin user that does not exist", async () => {
    await expect(add({ admin_user_id: "01970000-0000-7000-8000-ffffffffffff" })).rejects.toThrow(
      /foreign key constraint/,
    );
  });

  it("has the indexes of RFC-005 §7", async () => {
    expect(await indexesOf(client, "access", "sessions")).toEqual([
      "CREATE INDEX sessions_admin_user_id_idx ON access.sessions USING btree (admin_user_id)",
      "CREATE INDEX sessions_expires_at_idx ON access.sessions USING btree (expires_at)",
      "CREATE INDEX sessions_person_id_idx ON access.sessions USING btree (person_id)",
      "CREATE UNIQUE INDEX sessions_pkey ON access.sessions USING btree (id)",
    ]);
  });
});
