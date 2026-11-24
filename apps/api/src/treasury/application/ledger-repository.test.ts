import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import type { Database } from "../../db/database";
import { migratedTestDb } from "../../db/test-db";
import { insertEntryWithAudit } from "./ledger-repository";

// Banco falso em que o insert devolve zero linhas: exercita a defesa contra retorno vazio, que o banco real
// nunca produz (a chave única devolve a linha guardada).
const empty = Promise.resolve([] as never[]);
const fakeTx = { insert: () => ({ values: () => ({ onConflictDoUpdate: () => ({ returning: () => empty }) }) }) };
const fakeDb = {
  transaction: <T>(work: (tx: typeof fakeTx) => Promise<T>) => work(fakeTx),
} as unknown as PgDatabase<PgQueryResultHKT> as Database;

describe("insertEntryWithAudit: banco que devolve zero linhas", () => {
  it("fails when the insert returns no row, without writing the audit", async () => {
    let audited = false;
    const row = {
      id: "x",
      accountId: "x",
      type: "CAPITAL_IN",
      amountCents: 1,
      entryDate: "2026-11-20",
      createdBy: "x",
    };
    await expect(
      insertEntryWithAudit(fakeDb, row, () => {
        audited = true;
        throw new Error("não deve auditar");
      }),
    ).rejects.toThrow("ledger entry insert returned no row");
    expect(audited).toBe(false);
  });
});

const uuid = (n: number): string => `01970000-0000-7000-8000-${String(1000000000000 + n).slice(1)}`;

describe("insertEntryWithAudit: chave repetida entre duas requisições", () => {
  let client: PGlite;
  let db: Database;
  beforeAll(async () => {
    const migrated = await migratedTestDb();
    client = migrated.client;
    db = migrated.db;
    await client.query("insert into treasury.accounts (id, name) values ($1, 'Conta')", [uuid(1)]);
  });
  afterAll(async () => {
    await client.close();
  });

  it("returns the stored entry and writes no second audit row when the key already exists", async () => {
    const base = {
      accountId: uuid(1),
      type: "CAPITAL_IN",
      amountCents: 100,
      entryDate: "2026-11-20",
      createdBy: uuid(9),
    };
    const audits: string[] = [];
    const audit = (stored: { id: string }) => {
      audits.push(stored.id);
      return {
        id: uuid(100 + audits.length),
        actorType: "ADMIN" as const,
        actorId: null,
        action: "ledger_entry.created",
        entityType: "ledger_entry",
        entityId: stored.id,
        before: null,
        after: null,
        at: new Date("2026-11-20T15:00:00Z"),
        ip: null,
      };
    };
    const first = await insertEntryWithAudit(db, { ...base, id: uuid(10), idempotencyKey: "k" }, audit);
    const second = await insertEntryWithAudit(db, { ...base, id: uuid(11), idempotencyKey: "k" }, audit);
    expect(second.id).toBe(first.id);
    expect(audits).toEqual([uuid(10)]);
  });
});
