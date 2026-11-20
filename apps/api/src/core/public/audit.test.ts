import type { PGlite } from "@electric-sql/pglite";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migratedTestDb } from "../../db/test-db";
import { recordAudit, type AuditEntry } from "./audit";

describe("recordAudit", () => {
  let client: PGlite;
  let db: PgliteDatabase;

  beforeAll(async () => {
    const migrated = await migratedTestDb();
    client = migrated.client;
    db = migrated.db;
  });

  afterAll(async () => {
    await client.close();
  });

  const entry1: AuditEntry = {
    id: "01970000-0000-7000-8000-000000000001",
    actorType: "ADMIN",
    actorId: "01970000-0000-7000-8000-000000000002",
    action: "example.updated",
    entityType: "example",
    entityId: "01970000-0000-7000-8000-000000000003",
    before: { name: "Ana" },
    after: { name: "Ana Souza" },
    at: new Date("2026-11-17T12:00:00.000Z"),
    ip: "203.0.113.10",
  };

  const expectedRow1 = {
    actor_type: "ADMIN",
    actor_id: "01970000-0000-7000-8000-000000000002",
    action: "example.updated",
    entity_type: "example",
    entity_id: "01970000-0000-7000-8000-000000000003",
    before: { name: "Ana" },
    after: { name: "Ana Souza" },
    at: new Date("2026-11-17T12:00:00.000Z"),
    ip: "203.0.113.10",
  };

  it("stores ADMIN entry with all fields", async () => {
    await expect(recordAudit(db, entry1)).resolves.toBeUndefined();
    const { rows } = await client.query<{
      actor_type: string;
      actor_id: string | null;
      action: string;
      entity_type: string;
      entity_id: string;
      before: unknown;
      after: unknown;
      at: Date;
      ip: string | null;
    }>(
      "select actor_type, actor_id, action, entity_type, entity_id, before, after, at, ip from core.audit_log where id = $1",
      [entry1.id],
    );
    expect(rows).toEqual([expectedRow1]);
  });

  const entry2: AuditEntry = {
    id: "01970000-0000-7000-8000-000000000004",
    actorType: "SYSTEM",
    actorId: null,
    action: "example.created",
    entityType: "example",
    entityId: "01970000-0000-7000-8000-000000000005",
    before: null,
    after: { name: "Bia" },
    at: new Date("2026-11-17T13:30:00.000Z"),
    ip: null,
  };

  const expectedRow2 = {
    actor_type: "SYSTEM",
    actor_id: null,
    action: "example.created",
    entity_type: "example",
    entity_id: "01970000-0000-7000-8000-000000000005",
    before: null,
    after: { name: "Bia" },
    at: new Date("2026-11-17T13:30:00.000Z"),
    ip: null,
  };

  it("stores SYSTEM entry with nullable fields as null", async () => {
    await expect(recordAudit(db, entry2)).resolves.toBeUndefined();
    const { rows } = await client.query<{
      actor_type: string;
      actor_id: string | null;
      action: string;
      entity_type: string;
      entity_id: string;
      before: unknown;
      after: unknown;
      at: Date;
      ip: string | null;
    }>(
      "select actor_type, actor_id, action, entity_type, entity_id, before, after, at, ip from core.audit_log where id = $1",
      [entry2.id],
    );
    expect(rows).toEqual([expectedRow2]);
  });

  const entry3: AuditEntry = {
    ...entry1,
    id: "01970000-0000-7000-8000-000000000006",
  };

  it("rejects on duplicate id (primary key)", async () => {
    await expect(recordAudit(db, entry3)).resolves.toBeUndefined();
    await expect(recordAudit(db, entry3)).rejects.toThrow();
  });
});
