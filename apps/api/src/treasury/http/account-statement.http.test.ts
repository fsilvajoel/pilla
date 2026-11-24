import type { PGlite } from "@electric-sql/pglite";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { type AdminAgent, loginAsAdmin } from "../../core/http/test-admin-agent";
import { AppModule } from "../../app.module";
import { configureApp } from "../../core/http/configure-app";
import type { ApiEnv } from "../../core/http/env";
import { DATABASE_HANDLE } from "../../db/database";
import { migratedTestDb } from "../../db/test-db";

// E12-F03 C1 a C12 (A1 a A5, A7, A8): extrato da conta com saldo acumulado, período e paginação por cursor.
// Os lançamentos entram direto no ledger: o teste não depende do despachante do outbox.
const env: ApiEnv = { host: "127.0.0.1", port: 3000, databaseUrl: "postgres://u:p@127.0.0.1:1/pilla" };
const uuid = (n: number): string => `01970000-0000-7000-8000-${String(1000000000000 + n).slice(1)}`;
const ACCOUNT = uuid(1);
const OTHER_ACCOUNT = uuid(2);
const UNKNOWN_ACCOUNT = uuid(99);
const USER = uuid(3);
const LOAN = uuid(10);
const PAYMENT = uuid(20);

interface Entry {
  id: string;
  accountId: string;
  type: string;
  component: string | null;
  amountCents: number;
  entryDate: string;
  justification: string | null;
  sourceType: string | null;
  sourceId: string | null;
  createdAt: string;
  balanceAfterCents: number;
}
interface Statement {
  accountId: string;
  from: string | null;
  to: string | null;
  openingBalanceCents: number;
  closingBalanceCents: number;
  items: Entry[];
  nextCursor: string | null;
}
interface Problem {
  code: string;
}

interface Seed {
  id: number;
  type: string;
  amount: number;
  date: string;
  createdAt: string;
  component?: string;
  sourceType?: string;
  sourceId?: string;
  justification?: string;
}

// Saldos acumulados: 100000, 70000, 75000, 76500, 74500.
// e4 tem id menor que e3, mas nasce depois (created_at): o extrato ordena por created_at, não por id.
const SEEDS: Seed[] = [
  { id: 101, type: "CAPITAL_IN", amount: 100000, date: "2026-01-10", createdAt: "2026-01-10T12:00:00Z" },
  {
    id: 102,
    type: "DISBURSEMENT",
    amount: -30000,
    date: "2026-01-15",
    createdAt: "2026-01-15T12:00:00Z",
    component: "PRINCIPAL",
    sourceType: "LOAN",
    sourceId: LOAN,
  },
  {
    id: 104,
    type: "REPAYMENT",
    amount: 5000,
    date: "2026-02-01",
    createdAt: "2026-02-01T09:00:00Z",
    component: "PRINCIPAL",
    sourceType: "PAYMENT",
    sourceId: PAYMENT,
  },
  {
    id: 103,
    type: "REPAYMENT",
    amount: 1500,
    date: "2026-02-01",
    createdAt: "2026-02-01T09:01:00Z",
    component: "INTEREST",
    sourceType: "PAYMENT",
    sourceId: PAYMENT,
  },
  {
    id: 105,
    type: "ADJUSTMENT",
    amount: -2000,
    date: "2026-02-20",
    createdAt: "2026-02-20T12:00:00Z",
    justification: "Tarifa bancária",
  },
];

let client: PGlite;
let admin: AdminAgent;
let app: INestApplication;
let baseUrl: string;

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
  baseUrl = await app.getUrl();
  admin = await loginAsAdmin(baseUrl, client);
});
afterAll(async () => {
  await app.close();
  await client.close();
});
beforeEach(async () => {
  await client.query("delete from treasury.ledger_entries");
  await client.query("delete from treasury.accounts");
  await client.query(
    "insert into treasury.accounts (id, name, active) values ($1, 'Conta ativa', true), ($2, 'Outra conta', true)",
    [ACCOUNT, OTHER_ACCOUNT],
  );
});

async function insertEntry(accountId: string, seed: Seed): Promise<void> {
  await client.query(
    `insert into treasury.ledger_entries
       (id, account_id, type, amount_cents, component, source_type, source_id, entry_date, justification, created_by,
        created_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      uuid(seed.id),
      accountId,
      seed.type,
      seed.amount,
      seed.component ?? null,
      seed.sourceType ?? null,
      seed.sourceId ?? null,
      seed.date,
      seed.justification ?? null,
      USER,
      seed.createdAt,
    ],
  );
}

async function seedAll(): Promise<void> {
  for (const seed of SEEDS) await insertEntry(ACCOUNT, seed);
}

async function get(path: string): Promise<{ status: number; body: unknown }> {
  const res = await admin.get(path);
  return { status: res.status, body: res.body as unknown };
}

async function statement(query = "", accountId = ACCOUNT): Promise<{ status: number; body: Statement }> {
  const res = await get(`/api/v1/accounts/${accountId}/entries${query}`);
  return { status: res.status, body: res.body as Statement };
}

const ids = (items: Entry[]): string[] => items.map((item) => item.id);
const balances = (items: Entry[]): number[] => items.map((item) => item.balanceAfterCents);

describe("GET /api/v1/accounts/{id}/entries", () => {
  it("C1 (A1): without filters lists every entry in order with the running balance", async () => {
    await seedAll();
    await insertEntry(OTHER_ACCOUNT, {
      id: 900,
      type: "CAPITAL_IN",
      amount: 999999,
      date: "2026-01-01",
      createdAt: "2026-01-01T12:00:00Z",
    });
    const res = await statement();
    expect(res.status).toBe(200);
    expect(res.body.accountId).toBe(ACCOUNT);
    expect(res.body.from).toBeNull();
    expect(res.body.to).toBeNull();
    expect(res.body.openingBalanceCents).toBe(0);
    expect(ids(res.body.items)).toEqual([uuid(101), uuid(102), uuid(104), uuid(103), uuid(105)]);
    expect(balances(res.body.items)).toEqual([100000, 70000, 75000, 76500, 74500]);
    expect(res.body.closingBalanceCents).toBe(74500);
    expect(res.body.nextCursor).toBeNull();
  });

  it("C2 (A2): from and to keep only the period, with opening before from and closing at the last balance", async () => {
    await seedAll();
    const res = await statement("?from=2026-02-01&to=2026-02-10");
    expect(res.status).toBe(200);
    expect(res.body.from).toBe("2026-02-01");
    expect(res.body.to).toBe("2026-02-10");
    expect(res.body.openingBalanceCents).toBe(70000);
    expect(ids(res.body.items)).toEqual([uuid(104), uuid(103)]);
    expect(balances(res.body.items)).toEqual([75000, 76500]);
    expect(res.body.closingBalanceCents).toBe(76500);
  });

  it("C2 (A2): the bounds are inclusive and to alone closes the balance at that date", async () => {
    await seedAll();
    const res = await statement("?to=2026-01-15");
    expect(res.body.openingBalanceCents).toBe(0);
    expect(ids(res.body.items)).toEqual([uuid(101), uuid(102)]);
    expect(res.body.closingBalanceCents).toBe(70000);
  });

  it("C3 (A3): entries on the same day follow created_at, not the id", async () => {
    await seedAll();
    const res = await statement("?from=2026-02-01&to=2026-02-01");
    expect(res.body.items.map((item) => item.component)).toEqual(["PRINCIPAL", "INTEREST"]);
    expect(balances(res.body.items)).toEqual([75000, 76500]);
  });

  it("C4 (A4): limit and nextCursor walk the pages without repeating or skipping a row", async () => {
    await seedAll();
    const page1 = await statement("?limit=2");
    expect(page1.status).toBe(200);
    expect(ids(page1.body.items)).toEqual([uuid(101), uuid(102)]);
    expect(page1.body.nextCursor).not.toBeNull();

    const page2 = await statement(`?limit=2&cursor=${encodeURIComponent(page1.body.nextCursor ?? "")}`);
    expect(ids(page2.body.items)).toEqual([uuid(104), uuid(103)]);
    expect(page2.body.nextCursor).not.toBeNull();

    const page3 = await statement(`?limit=2&cursor=${encodeURIComponent(page2.body.nextCursor ?? "")}`);
    expect(ids(page3.body.items)).toEqual([uuid(105)]);
    expect(page3.body.nextCursor).toBeNull();
  });

  it("C5 (A4): the running balance stays right on page two and the totals do not change", async () => {
    await seedAll();
    const page1 = await statement("?limit=2");
    const page2 = await statement(`?limit=2&cursor=${encodeURIComponent(page1.body.nextCursor ?? "")}`);
    expect(balances(page2.body.items)).toEqual([75000, 76500]);
    expect(page2.body.openingBalanceCents).toBe(0);
    expect(page2.body.closingBalanceCents).toBe(74500);
  });

  it("C6 (A5): automatic and manual entries carry type, component, sourceType and sourceId", async () => {
    await seedAll();
    const res = await statement();
    const [capital, disbursement, repayment, , adjustment] = res.body.items;
    expect(capital).toMatchObject({
      type: "CAPITAL_IN",
      component: null,
      sourceType: null,
      sourceId: null,
      amountCents: 100000,
      entryDate: "2026-01-10",
      accountId: ACCOUNT,
    });
    expect(disbursement).toMatchObject({
      type: "DISBURSEMENT",
      component: "PRINCIPAL",
      sourceType: "LOAN",
      sourceId: LOAN,
      amountCents: -30000,
    });
    expect(repayment).toMatchObject({
      type: "REPAYMENT",
      component: "PRINCIPAL",
      sourceType: "PAYMENT",
      sourceId: PAYMENT,
    });
    expect(adjustment).toMatchObject({ type: "ADJUSTMENT", justification: "Tarifa bancária", amountCents: -2000 });
    expect(new Date(capital?.createdAt ?? "").toISOString()).toBe("2026-01-10T12:00:00.000Z");
  });

  it("C7 (A7): a period without entries gives empty items and opening equal to closing", async () => {
    await seedAll();
    const res = await statement("?from=2026-01-20&to=2026-01-31");
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.openingBalanceCents).toBe(70000);
    expect(res.body.closingBalanceCents).toBe(70000);
    expect(res.body.nextCursor).toBeNull();
  });

  it("C7 (A7): an account without entries gives zero everywhere", async () => {
    const res = await statement();
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.openingBalanceCents).toBe(0);
    expect(res.body.closingBalanceCents).toBe(0);
  });

  it("C8 (A8): from after to gives 400 VALIDATION_FAILED", async () => {
    const res = await get(`/api/v1/accounts/${ACCOUNT}/entries?from=2026-03-01&to=2026-02-01`);
    expect(res.status).toBe(400);
    expect((res.body as Problem).code).toBe("VALIDATION_FAILED");
  });

  it.each(["2027-13-01", "01/02/2027", "x"])("C9 (A8): from=%s gives 400 VALIDATION_FAILED", async (from) => {
    const res = await get(`/api/v1/accounts/${ACCOUNT}/entries?from=${encodeURIComponent(from)}`);
    expect(res.status).toBe(400);
    expect((res.body as Problem).code).toBe("VALIDATION_FAILED");
  });

  it("C9 (A8): an invalid to gives 400 VALIDATION_FAILED", async () => {
    const res = await get(`/api/v1/accounts/${ACCOUNT}/entries?to=2027-02-30`);
    expect(res.status).toBe(400);
    expect((res.body as Problem).code).toBe("VALIDATION_FAILED");
  });

  it.each(["0", "201", "x"])("C10 (A8): limit=%s gives 400 VALIDATION_FAILED", async (limit) => {
    const res = await get(`/api/v1/accounts/${ACCOUNT}/entries?limit=${limit}`);
    expect(res.status).toBe(400);
    expect((res.body as Problem).code).toBe("VALIDATION_FAILED");
  });

  it("C10 (A8): limit 200 is accepted", async () => {
    const res = await get(`/api/v1/accounts/${ACCOUNT}/entries?limit=200`);
    expect(res.status).toBe(200);
  });

  it("C11 (A8): a tampered cursor gives 400 VALIDATION_FAILED", async () => {
    await seedAll();
    const page1 = await statement("?limit=2");
    const cursor = page1.body.nextCursor ?? "";
    for (const bad of ["lixo", `${cursor}x`, cursor.slice(0, -4)]) {
      const res = await get(`/api/v1/accounts/${ACCOUNT}/entries?limit=2&cursor=${encodeURIComponent(bad)}`);
      expect(res.status).toBe(400);
      expect((res.body as Problem).code).toBe("VALIDATION_FAILED");
    }
  });

  it("C12 (A8): an unknown account gives 404 NOT_FOUND", async () => {
    const res = await get(`/api/v1/accounts/${UNKNOWN_ACCOUNT}/entries`);
    expect(res.status).toBe(404);
    expect((res.body as Problem).code).toBe("NOT_FOUND");
  });

  it("C12 (A8): an id that is not a uuid gives 400 VALIDATION_FAILED", async () => {
    const res = await get("/api/v1/accounts/x/entries");
    expect(res.status).toBe(400);
    expect((res.body as Problem).code).toBe("VALIDATION_FAILED");
  });
});
