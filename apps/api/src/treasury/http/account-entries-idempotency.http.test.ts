import type { PGlite } from "@electric-sql/pglite";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { type AdminAgent, loginAsAdmin } from "../../core/http/test-admin-agent";
import { AppModule } from "../../app.module";
import { configureApp } from "../../core/http/configure-app";
import type { ApiEnv } from "../../core/http/env";
import { DATABASE_HANDLE } from "../../db/database";
import { migratedTestDb } from "../../db/test-db";

// D6 (E12-F02): a mesma Idempotency-Key com conta ou corpo diferente é recusada com 409.
const env: ApiEnv = { host: "127.0.0.1", port: 3000, databaseUrl: "postgres://u:p@127.0.0.1:1/pilla" };
const uuid = (n: number): string => `01970000-0000-7000-8000-${String(1000000000000 + n).slice(1)}`;
const ACCOUNT = uuid(2);
const OTHER = uuid(3);
const TODAY = "2026-11-20";

type Body = { id?: string; code?: string; errors?: { field: string }[] };

let client: PGlite;
let admin: AdminAgent;
let app: INestApplication;

beforeAll(async () => {
  const migrated = await migratedTestDb();
  client = migrated.client;
  const moduleRef = await Test.createTestingModule({ imports: [AppModule.forRoot(env, { outboxPoller: false })] })
    .overrideProvider(DATABASE_HANDLE)
    .useValue({ db: migrated.db, close: () => Promise.resolve() })
    .compile();
  app = moduleRef.createNestApplication();
  configureApp(app);
  app.useLogger(false);
  await app.listen(0, "127.0.0.1");
  admin = await loginAsAdmin(await app.getUrl(), client);
});
afterAll(async () => {
  await app.close();
  await client.close();
});
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-20T15:00:00Z"));
  await client.query("delete from core.audit_log");
  await client.query("delete from treasury.ledger_entries");
  await client.query("delete from treasury.accounts");
  await client.query("insert into treasury.accounts (id, name, active) values ($1, 'A', true), ($2, 'B', true)", [
    ACCOUNT,
    OTHER,
  ]);
});
afterEach(() => {
  vi.useRealTimers();
});

async function post(
  accountId: string,
  payload: Record<string, unknown>,
  key: string,
): Promise<{ status: number; body: Body }> {
  const res = await admin.post(`/api/v1/accounts/${accountId}/entries`).set("Idempotency-Key", key).send(payload);
  return { status: res.status, body: res.body as Body };
}

async function rowCount(): Promise<number> {
  const res = await client.query<{ n: string | number }>("select count(*) as n from treasury.ledger_entries");
  return Number(res.rows[0]?.n);
}

const base = { type: "CAPITAL_IN", amountCents: 100000, entryDate: TODAY };

describe("POST /api/v1/accounts/{id}/entries: chave reaproveitada", () => {
  it("the same key with another account answers 409 and writes nothing new", async () => {
    await post(ACCOUNT, base, "k1");
    const second = await post(OTHER, base, "k1");
    expect(second.status).toBe(409);
    expect(second.body.code).toBe("IDEMPOTENCY_KEY_REUSED");
    expect(await rowCount()).toBe(1);
  });

  it.each([
    ["amount", { ...base, amountCents: 5 }],
    ["type", { ...base, type: "CAPITAL_OUT" }],
    ["date", { ...base, entryDate: "2026-11-19" }],
    ["justification", { ...base, justification: "outra" }],
  ])("the same key with another %s answers 409", async (_name, other) => {
    await post(ACCOUNT, base, "k2");
    const second = await post(ACCOUNT, other, "k2");
    expect(second.status).toBe(409);
    expect(second.body.code).toBe("IDEMPOTENCY_KEY_REUSED");
    expect(await rowCount()).toBe(1);
  });

  it("the same key with the same body still replays the stored entry", async () => {
    const first = await post(ACCOUNT, base, "k3");
    const second = await post(ACCOUNT, base, "k3");
    expect(second.status).toBe(201);
    expect(second.body.id).toBe(first.body.id);
  });

  it("a key of 100 characters is accepted and 101 answers 400", async () => {
    expect((await post(ACCOUNT, base, "a".repeat(100))).status).toBe(201);
    const long = await post(ACCOUNT, base, "a".repeat(101));
    expect(long.status).toBe(400);
    expect(long.body.code).toBe("VALIDATION_FAILED");
  });
});
