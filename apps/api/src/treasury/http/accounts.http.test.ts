import type { PGlite } from "@electric-sql/pglite";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { accountListResponse } from "@pilla/schemas";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { type AdminAgent, loginAsAdmin } from "../../core/http/test-admin-agent";
import { AppModule } from "../../app.module";
import { configureApp } from "../../core/http/configure-app";
import type { ApiEnv } from "../../core/http/env";
import { DATABASE_HANDLE } from "../../db/database";
import { migratedTestDb, type MigratedTestDb } from "../../db/test-db";
import { BASE_ACCOUNT_ID, BASE_ACCOUNT_NAME, seedBaseAccount } from "../infra/account-repository";

const INACTIVE_ID = "01970000-0000-7000-8000-000000000001";
const ACTIVE_ID = "01970000-0000-7000-8000-000000000002";
const USER = "01970000-0000-7000-8000-000000000003";
const ENTRY_A = "01970000-0000-7000-8000-000000000011";
const ENTRY_B = "01970000-0000-7000-8000-000000000012";

const env: ApiEnv = { host: "127.0.0.1", port: 3000, databaseUrl: "postgres://u:p@127.0.0.1:1/pilla" };

interface AccountsBody {
  items: { id: string; balanceCents: number }[];
}

let handle: MigratedTestDb;
let client: PGlite;
let admin: AdminAgent;
let app: INestApplication;
let baseUrl: string;

beforeAll(async () => {
  handle = await migratedTestDb();
  client = handle.client;
  const moduleRef = await Test.createTestingModule({ imports: [AppModule.forRoot(env, { outboxPoller: false })] })
    .overrideProvider(DATABASE_HANDLE)
    .useValue({ db: handle.db, close: () => Promise.resolve() })
    .compile();
  app = moduleRef.createNestApplication();
  configureApp(app);
  await app.listen(0, "127.0.0.1");
  baseUrl = await app.getUrl();
  admin = await loginAsAdmin(baseUrl, client);
});
afterAll(async () => {
  await app.close();
  await handle.close();
});
beforeEach(async () => {
  await client.query("delete from treasury.ledger_entries");
  await client.query("delete from treasury.accounts");
});

async function getAccounts(): Promise<{ status: number; body: unknown }> {
  const res = await admin.get("/api/v1/accounts");
  return { status: res.status, body: res.body as unknown };
}

describe("GET /api/v1/accounts", () => {
  it("C6: answers 200 in the accountListResponse schema with the active accounts first", async () => {
    await client.query(
      `insert into treasury.accounts (id, name, active) values ($1, 'Antiga', false), ($2, 'Atual', true)`,
      [INACTIVE_ID, ACTIVE_ID],
    );
    const res = await getAccounts();
    expect(res.status).toBe(200);
    const parsed = accountListResponse.parse(res.body);
    expect(parsed.items).toEqual([
      { id: ACTIVE_ID, name: "Atual", active: true, balanceCents: 0 },
      { id: INACTIVE_ID, name: "Antiga", active: false, balanceCents: 0 },
    ]);
  });

  it("answers an empty list when there are no accounts", async () => {
    const res = await getAccounts();
    expect(res.status).toBe(200);
    expect(accountListResponse.parse(res.body).items).toEqual([]);
  });

  it("C7: the base account seed is idempotent", async () => {
    await seedBaseAccount(handle.db);
    await seedBaseAccount(handle.db);
    const res = await getAccounts();
    expect(accountListResponse.parse(res.body).items).toEqual([
      { id: BASE_ACCOUNT_ID, name: BASE_ACCOUNT_NAME, active: true, balanceCents: 0 },
    ]);
    expect(BASE_ACCOUNT_NAME).toBe("Conta principal");
  });

  it("C13 (A6): balanceCents is the sum of the account entries and equals the unfiltered closing balance", async () => {
    await client.query(
      `insert into treasury.accounts (id, name, active) values ($1, 'Atual', true), ($2, 'Vazia', true)`,
      [ACTIVE_ID, INACTIVE_ID],
    );
    await client.query(
      `insert into treasury.ledger_entries (id, account_id, type, amount_cents, entry_date, created_by)
       values ($1, $3, 'CAPITAL_IN', 100000, '2026-01-10', $4), ($2, $3, 'CAPITAL_OUT', -25000, '2026-01-12', $4)`,
      [ENTRY_A, ENTRY_B, ACTIVE_ID, USER],
    );
    const list = await getAccounts();
    const byId = new Map((list.body as AccountsBody).items.map((item) => [item.id, item]));
    expect(byId.get(ACTIVE_ID)).toMatchObject({ balanceCents: 75000 });
    const statement = await admin.get(`/api/v1/accounts/${ACTIVE_ID}/entries`);
    expect(statement.status).toBe(200);
    expect((statement.body as { closingBalanceCents: number }).closingBalanceCents).toBe(75000);
  });

  it("C14 (A6): an account without entries has balanceCents 0, even next to one with entries", async () => {
    await client.query(
      `insert into treasury.accounts (id, name, active) values ($1, 'Atual', true), ($2, 'Vazia', true)`,
      [ACTIVE_ID, INACTIVE_ID],
    );
    await client.query(
      `insert into treasury.ledger_entries (id, account_id, type, amount_cents, entry_date, justification, created_by)
       values ($1, $2, 'ADJUSTMENT', -500, '2026-01-10', 'Tarifa bancária', $3)`,
      [ENTRY_A, ACTIVE_ID, USER],
    );
    const list = await getAccounts();
    const byId = new Map((list.body as AccountsBody).items.map((item) => [item.id, item]));
    expect(byId.get(INACTIVE_ID)).toMatchObject({ balanceCents: 0 });
    expect(byId.get(ACTIVE_ID)).toMatchObject({ balanceCents: -500 });
  });
});
