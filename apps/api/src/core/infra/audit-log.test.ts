import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migratedTestDb } from "../../db/test-db";

// Contrato da tabela em SQL (RFC-005 §2): o teste não depende dos nomes TypeScript do schema.ts.
const entityId = "01970000-0000-7000-8000-0000000000bb";
const insert = "insert into core.audit_log (id, actor_type, actor_id, action, entity_type, entity_id, at, ip)";
type Column = { column_name: string; data_type: string; is_nullable: string };

describe("core.audit_log (RFC-005 §2)", () => {
  let client: PGlite;
  beforeAll(async () => ({ client } = await migratedTestDb()));
  afterAll(async () => client.close());

  it("has exactly the columns of RFC-005 §2 with their types and nullability", async () => {
    const { rows } = await client.query<Column>(
      "select column_name, data_type, is_nullable from information_schema.columns where table_schema = 'core' and table_name = 'audit_log' order by column_name",
    );
    expect(rows.map((c) => `${c.column_name} ${c.data_type} ${c.is_nullable === "YES" ? "null" : "not null"}`)).toEqual(
      [
        "action text not null",
        "actor_id uuid null",
        "actor_type text not null",
        "after jsonb null",
        "at timestamp with time zone not null",
        "before jsonb null",
        "entity_id uuid not null",
        "entity_type text not null",
        "id uuid not null",
        "ip inet null",
      ],
    );
  });

  it("records an admin change with before, after and ip", async () => {
    await client.query(
      `${insert.replace(", ip)", ", ip, before, after)")} values ($1, 'ADMIN', $2, 'loan.activated', 'loan', $3, now(), '10.0.0.7', $4, $5)`,
      [
        "01970000-0000-7000-8000-000000000101",
        "01970000-0000-7000-8000-0000000000cc",
        entityId,
        { status: "DRAFT" },
        { status: "ACTIVE" },
      ],
    );
    const { rows } = await client.query<{ before: unknown; after: unknown; ip: string }>(
      "select before, after, host(ip) as ip from core.audit_log where actor_type = 'ADMIN'",
    );
    expect(rows).toEqual([{ before: { status: "DRAFT" }, after: { status: "ACTIVE" }, ip: "10.0.0.7" }]);
  });

  it.each(["ADMIN", "CLIENT", "SYSTEM"])("accepts actor type %s", async (actorType) => {
    const result = await client.query(`${insert} values (gen_random_uuid(), $1, null, 'x', 'loan', $2, now(), null)`, [
      actorType,
      entityId,
    ]);
    expect(result.affectedRows).toBe(1);
  });

  it("refuses an actor type outside ADMIN, CLIENT, SYSTEM", async () => {
    const bad = client.query(`${insert} values (gen_random_uuid(), 'ROBOT', null, 'x', 'loan', $1, now(), null)`, [
      entityId,
    ]);
    await expect(bad).rejects.toThrow(/check constraint/);
  });

  it("indexes (entity_type, entity_id, at) for the entity history", async () => {
    const { rows } = await client.query<{ indexdef: string }>(
      "select indexdef from pg_indexes where schemaname = 'core' and tablename = 'audit_log'",
    );
    expect(rows.map((r) => r.indexdef).join("\n")).toMatch(/\(entity_type, entity_id, at\)/);
  });
});
