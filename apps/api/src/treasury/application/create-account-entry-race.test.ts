import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Database } from "../../db/database";
import { migratedTestDb } from "../../db/test-db";
import type { RequestActor } from "../../core/public/actor";
import { createAccountEntry } from "./create-account-entry";

// Corrida entre duas requisições com a mesma Idempotency-Key: a busca prévia não acha nada (a outra ainda não
// gravara), mas o insert esbarra na chave única e devolve a linha da vencedora.
vi.mock("./ledger-repository", async (importOriginal) => {
  const original = await importOriginal<typeof import("./ledger-repository")>();
  return { ...original, findEntryByIdempotencyKey: () => Promise.resolve(null) };
});

const uuid = (n: number): string => `01970000-0000-7000-8000-${String(1000000000000 + n).slice(1)}`;
const ACCOUNT = uuid(1);
const actor: RequestActor = { type: "ADMIN", adminUserId: uuid(9), ip: null };
const NOW = new Date("2026-11-20T15:00:00Z");
const request = { type: "CAPITAL_IN", amountCents: 1000, entryDate: "2026-11-20" } as const;

let client: PGlite;
let db: Database;

beforeAll(async () => {
  const migrated = await migratedTestDb();
  client = migrated.client;
  db = migrated.db;
  await client.query("insert into treasury.accounts (id, name, active) values ($1, 'A', true)", [ACCOUNT]);
});
afterAll(async () => {
  await client.close();
});

describe("createAccountEntry: corrida na mesma Idempotency-Key", () => {
  it("devolve o lançamento da requisição vencedora, sem segunda linha nem segunda auditoria", async () => {
    const first = await createAccountEntry(db, ACCOUNT, request, "corrida", NOW, actor);
    const second = await createAccountEntry(db, ACCOUNT, request, "corrida", NOW, actor);
    expect(second.id).toBe(first.id);
    const entries = await client.query<{ n: number }>("select count(*)::int as n from treasury.ledger_entries");
    expect(entries.rows[0]?.n).toBe(1);
    const audits = await client.query<{ n: number }>(
      "select count(*)::int as n from core.audit_log where entity_id = $1",
      [first.id],
    );
    expect(audits.rows[0]?.n).toBe(1);
  });

  it("recusa com 409 quando a vencedora gravou outro pedido com a mesma chave", async () => {
    await createAccountEntry(db, ACCOUNT, request, "corrida-2", NOW, actor);
    await expect(
      createAccountEntry(db, ACCOUNT, { ...request, amountCents: 5 }, "corrida-2", NOW, actor),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_KEY_REUSED" });
  });
});
