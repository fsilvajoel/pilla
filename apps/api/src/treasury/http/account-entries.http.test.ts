import type { PGlite } from "@electric-sql/pglite";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AppModule } from "../../app.module";
import { configureApp } from "../../core/http/configure-app";
import type { ApiEnv } from "../../core/http/env";
import { DATABASE_HANDLE } from "../../db/database";
import { migratedTestDb } from "../../db/test-db";

// E12-F02 C1 a C16 (A1 a A10): POST /api/v1/accounts/{id}/entries. O saldo prévio entra direto no ledger.
const env: ApiEnv = { host: "127.0.0.1", port: 3000, databaseUrl: "postgres://u:p@127.0.0.1:1/pilla" };
const uuid = (n: number): string => `01970000-0000-7000-8000-${String(1000000000000 + n).slice(1)}`;
const ACCOUNT = uuid(2);
const INACTIVE = uuid(3);
const UNKNOWN = uuid(999);
const ACTOR = uuid(50);
// Hoje em Brasília: 2026-11-20.
const TODAY = "2026-11-20";
const TOMORROW = "2026-11-21";

type Body = {
  id?: string;
  accountId?: string;
  type?: string;
  component?: string | null;
  amountCents?: number;
  entryDate?: string;
  justification?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  createdAt?: string;
  code?: string;
  errors?: { field: string }[];
};
type EntryRow = {
  id: string;
  account_id: string;
  type: string;
  amount_cents: string | number;
  component: string | null;
  source_type: string | null;
  source_id: string | null;
  source_event_id: string | null;
  entry_date: string | Date;
  justification: string | null;
};

let client: PGlite;
let app: INestApplication;
let baseUrl: string;

beforeAll(async () => {
  const migrated = await migratedTestDb();
  client = migrated.client;
  const moduleRef = await Test.createTestingModule({ imports: [AppModule.forRoot(env)] })
    .overrideProvider(DATABASE_HANDLE)
    .useValue({ db: migrated.db, close: () => Promise.resolve() })
    .compile();
  app = moduleRef.createNestApplication();
  configureApp(app);
  app.useLogger(false);
  await app.listen(0, "127.0.0.1");
  baseUrl = await app.getUrl();
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
  await client.query("insert into treasury.accounts (id, name, active) values ($1, 'Conta ativa', true)", [ACCOUNT]);
  await client.query("insert into treasury.accounts (id, name, active) values ($1, 'Conta inativa', false)", [
    INACTIVE,
  ]);
});
afterEach(() => {
  vi.useRealTimers();
});

async function post(
  accountId: string,
  payload: Record<string, unknown>,
  key?: string,
): Promise<{ status: number; body: Body }> {
  const call = request(baseUrl).post(`/api/v1/accounts/${accountId}/entries`);
  const res = await (key === undefined ? call : call.set("Idempotency-Key", key)).send(payload);
  return { status: res.status, body: res.body as Body };
}

async function entries(): Promise<EntryRow[]> {
  const res = await client.query<EntryRow>(
    `select id, account_id, type, amount_cents, component, source_type, source_id, source_event_id,
            entry_date::text as entry_date, justification
       from treasury.ledger_entries order by created_at, id`,
  );
  return res.rows;
}

async function auditCount(): Promise<number> {
  const res = await client.query<{ n: string | number }>("select count(*) as n from core.audit_log");
  return Number(res.rows[0]?.n);
}

async function seedBalance(cents: number): Promise<void> {
  await client.query(
    `insert into treasury.ledger_entries (id, account_id, type, amount_cents, entry_date, created_by)
     values ($1, $2, 'CAPITAL_IN', $3, '2026-11-01', $4)`,
    [uuid(60), ACCOUNT, cents, ACTOR],
  );
}

describe("POST /api/v1/accounts/{id}/entries: lançamentos", () => {
  it("C1 (A1): a deposit writes +amountCents with no component or source and answers 201", async () => {
    const { status, body } = await post(ACCOUNT, { type: "CAPITAL_IN", amountCents: 100000, entryDate: TODAY });
    expect(status).toBe(201);
    expect(body).toMatchObject({
      accountId: ACCOUNT,
      type: "CAPITAL_IN",
      component: null,
      amountCents: 100000,
      entryDate: TODAY,
      justification: null,
      sourceType: null,
      sourceId: null,
    });
    expect(typeof body.createdAt).toBe("string");
    const rows = await entries();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: body.id,
      account_id: ACCOUNT,
      type: "CAPITAL_IN",
      component: null,
      source_type: null,
      source_id: null,
      source_event_id: null,
      entry_date: TODAY,
    });
    expect(Number(rows[0]?.amount_cents)).toBe(100000);
  });

  it("C2 (A2): a withdrawal receives a positive amount and writes -amountCents", async () => {
    const { status, body } = await post(ACCOUNT, { type: "CAPITAL_OUT", amountCents: 25000, entryDate: TODAY });
    expect(status).toBe(201);
    expect(body.amountCents).toBe(-25000);
    expect(body.type).toBe("CAPITAL_OUT");
    const rows = await entries();
    expect(rows).toHaveLength(1);
    expect(Number(rows[0]?.amount_cents)).toBe(-25000);
  });

  it("C3 (A3): an adjustment writes the signed amount with its justification, positive and negative", async () => {
    const up = await post(ACCOUNT, {
      type: "ADJUSTMENT",
      amountCents: 1500,
      entryDate: TODAY,
      justification: "Sobra de caixa",
    });
    const down = await post(ACCOUNT, {
      type: "ADJUSTMENT",
      amountCents: -700,
      entryDate: TODAY,
      justification: "Tarifa bancária",
    });
    expect(up.status).toBe(201);
    expect(down.status).toBe(201);
    expect(up.body).toMatchObject({ amountCents: 1500, justification: "Sobra de caixa", component: null });
    expect(down.body).toMatchObject({ amountCents: -700, justification: "Tarifa bancária", sourceType: null });
    const rows = await entries();
    expect(rows.map((row) => [row.type, Number(row.amount_cents), row.justification])).toEqual([
      ["ADJUSTMENT", 1500, "Sobra de caixa"],
      ["ADJUSTMENT", -700, "Tarifa bancária"],
    ]);
  });

  it("C4 (A4): each entry writes a ledger_entry.created audit row", async () => {
    const first = await post(ACCOUNT, { type: "CAPITAL_IN", amountCents: 100000, entryDate: TODAY });
    const second = await post(ACCOUNT, { type: "CAPITAL_OUT", amountCents: 500, entryDate: TODAY });
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    const audit = await client.query<{ action: string; entity_id: string; after: { amountCents?: number } | null }>(
      "select action, entity_id, after from core.audit_log order by at, id",
    );
    expect(audit.rows.map((row) => [row.action, row.entity_id])).toEqual([
      ["ledger_entry.created", first.body.id],
      ["ledger_entry.created", second.body.id],
    ]);
    expect(audit.rows[0]?.after).toMatchObject({ amountCents: 100000 });
  });

  it("C5 (A5): the same Idempotency-Key twice writes one entry and both answers carry the same id", async () => {
    const payload = { type: "CAPITAL_IN", amountCents: 100000, entryDate: TODAY };
    const first = await post(ACCOUNT, payload, "chave-1");
    const second = await post(ACCOUNT, payload, "chave-1");
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.id).toBe(first.body.id);
    expect(await entries()).toHaveLength(1);
    expect(await auditCount()).toBe(1);
  });

  it("C5: a different Idempotency-Key writes another entry", async () => {
    const payload = { type: "CAPITAL_IN", amountCents: 100000, entryDate: TODAY };
    const first = await post(ACCOUNT, payload, "chave-1");
    const second = await post(ACCOUNT, payload, "chave-2");
    expect(second.body.id).not.toBe(first.body.id);
    expect(await entries()).toHaveLength(2);
  });
});

describe("POST /api/v1/accounts/{id}/entries: data e conta", () => {
  it("C6 (A6): an entryDate of today in Brasília is accepted, even late at night", async () => {
    vi.setSystemTime(new Date("2026-11-21T01:30:00Z"));
    const { status, body } = await post(ACCOUNT, { type: "CAPITAL_IN", amountCents: 100, entryDate: TODAY });
    expect(status).toBe(201);
    expect(body.entryDate).toBe(TODAY);
  });

  it("C7 (A6): tomorrow answers 422 VALIDATION_FAILED on entryDate and writes nothing", async () => {
    const { status, body } = await post(ACCOUNT, { type: "CAPITAL_IN", amountCents: 100, entryDate: TOMORROW });
    expect(status).toBe(422);
    expect(body.code).toBe("VALIDATION_FAILED");
    expect(body.errors?.map((error) => error.field)).toEqual(["entryDate"]);
    expect(await entries()).toHaveLength(0);
    expect(await auditCount()).toBe(0);
  });

  it("C8 (A7): an unknown account answers 404 NOT_FOUND and writes nothing", async () => {
    const { status, body } = await post(UNKNOWN, { type: "CAPITAL_IN", amountCents: 100, entryDate: TODAY });
    expect(status).toBe(404);
    expect(body.code).toBe("NOT_FOUND");
    expect(await entries()).toHaveLength(0);
    expect(await auditCount()).toBe(0);
  });

  it("C9 (A7): an inactive account answers 422 VALIDATION_FAILED on accountId and writes nothing", async () => {
    const { status, body } = await post(INACTIVE, { type: "CAPITAL_IN", amountCents: 100, entryDate: TODAY });
    expect(status).toBe(422);
    expect(body.code).toBe("VALIDATION_FAILED");
    expect(body.errors?.map((error) => error.field)).toEqual(["accountId"]);
    expect(await entries()).toHaveLength(0);
    expect(await auditCount()).toBe(0);
  });
});

describe("POST /api/v1/accounts/{id}/entries: recusas", () => {
  const refused: [string, Record<string, unknown>][] = [
    ["C10: a system type (DISBURSEMENT)", { type: "DISBURSEMENT", amountCents: 100, entryDate: TODAY }],
    ["C10: a system type (REPAYMENT)", { type: "REPAYMENT", amountCents: 100, entryDate: TODAY }],
    ["C10: a system type (REVERSAL)", { type: "REVERSAL", amountCents: 100, entryDate: TODAY }],
    ["C11: a zero amount", { type: "CAPITAL_IN", amountCents: 0, entryDate: TODAY }],
    ["C11: a fractional amount", { type: "CAPITAL_IN", amountCents: 10.5, entryDate: TODAY }],
    ["C12: a negative withdrawal", { type: "CAPITAL_OUT", amountCents: -100, entryDate: TODAY }],
    ["C13: an adjustment without justification", { type: "ADJUSTMENT", amountCents: 100, entryDate: TODAY }],
    [
      "C13: an adjustment with a blank justification",
      { type: "ADJUSTMENT", amountCents: 100, entryDate: TODAY, justification: "   " },
    ],
    ["C13: a zero adjustment", { type: "ADJUSTMENT", amountCents: 0, entryDate: TODAY, justification: "x" }],
    ["C14: an unknown key", { type: "CAPITAL_IN", amountCents: 100, entryDate: TODAY, note: "x" }],
    ["C14: a date in another format", { type: "CAPITAL_IN", amountCents: 100, entryDate: "20/11/2026" }],
  ];
  it.each(refused)(
    "C15 (A8, A9): %s answers 400 VALIDATION_FAILED and writes no entry or audit row",
    async (_name, payload) => {
      const { status, body } = await post(ACCOUNT, payload);
      expect(status).toBe(400);
      expect(body.code).toBe("VALIDATION_FAILED");
      expect(await entries()).toHaveLength(0);
      expect(await auditCount()).toBe(0);
    },
  );

  it("C14: an account id that is not a UUID answers 400 VALIDATION_FAILED", async () => {
    const { status, body } = await post("x", { type: "CAPITAL_IN", amountCents: 100, entryDate: TODAY });
    expect(status).toBe(400);
    expect(body.code).toBe("VALIDATION_FAILED");
  });

  it("C14: an empty Idempotency-Key answers 400 VALIDATION_FAILED and writes nothing", async () => {
    const { status, body } = await post(ACCOUNT, { type: "CAPITAL_IN", amountCents: 100, entryDate: TODAY }, "");
    expect(status).toBe(400);
    expect(body.code).toBe("VALIDATION_FAILED");
    expect(await entries()).toHaveLength(0);
  });
});

describe("POST /api/v1/accounts/{id}/entries: saldo negativo", () => {
  it("C16 (A10): a withdrawal above the balance is accepted and leaves a negative balance", async () => {
    await seedBalance(10000);
    const { status, body } = await post(ACCOUNT, { type: "CAPITAL_OUT", amountCents: 25000, entryDate: TODAY });
    expect(status).toBe(201);
    expect(body.amountCents).toBe(-25000);
    const sum = await client.query<{ balance: string | number }>(
      "select sum(amount_cents) as balance from treasury.ledger_entries where account_id = $1",
      [ACCOUNT],
    );
    expect(Number(sum.rows[0]?.balance)).toBe(-15000);
  });
});
