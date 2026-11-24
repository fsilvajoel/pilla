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
import { BASE_ACCOUNT_ID } from "../infra/account-repository";

// D6 (E12-F04): totais do mês só das contas ativas, como o caixa, e teto vindo da conta base.
const env: ApiEnv = { host: "127.0.0.1", port: 3000, databaseUrl: "postgres://u:p@127.0.0.1:1/pilla" };
const uuid = (n: number): string => `01970000-0000-7000-8000-${String(1000000000000 + n).slice(1)}`;
const OLD_ACTIVE = uuid(2);
const INACTIVE = uuid(3);
const USER = uuid(4);

type Summary = {
  readonly maxCommittedBps: number | null;
  readonly interestReceivedCents: number;
  readonly lateChargesReceivedCents: number;
  readonly recoveredCents: number;
};

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
});
afterAll(async () => {
  await app.close();
  await client.close();
});
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-12-05T15:00:00Z"));
  admin = await loginAsAdmin(baseUrl, client);
  await client.query("delete from treasury.ledger_entries");
  await client.query("delete from treasury.accounts");
});
afterEach(() => {
  vi.useRealTimers();
});

async function repayment(id: string, accountId: string, component: string, cents: number): Promise<void> {
  await client.query(
    `insert into treasury.ledger_entries (id, account_id, type, amount_cents, component, entry_date, created_by)
     values ($1, $2, 'REPAYMENT', $3, $4, '2026-12-01', $5)`,
    [id, accountId, cents, component, USER],
  );
}

async function summary(): Promise<Summary> {
  const res = await admin.get("/api/v1/treasury/summary");
  expect(res.status).toBe(200);
  return res.body as Summary;
}

describe("GET /api/v1/treasury/summary: contas", () => {
  it("month totals ignore the entries of an inactive account, like the cash does", async () => {
    await client.query("insert into treasury.accounts (id, name, active) values ($1, 'A', true), ($2, 'B', false)", [
      OLD_ACTIVE,
      INACTIVE,
    ]);
    await repayment(uuid(10), OLD_ACTIVE, "INTEREST", 1000);
    await repayment(uuid(11), INACTIVE, "INTEREST", 5000);
    await repayment(uuid(12), INACTIVE, "LATE_CHARGES", 700);
    await repayment(uuid(13), INACTIVE, "RECOVERY", 900);
    expect(await summary()).toMatchObject({
      interestReceivedCents: 1000,
      lateChargesReceivedCents: 0,
      recoveredCents: 0,
    });
  });

  it("the cap comes from the base account, not from the first active one", async () => {
    await client.query(
      `insert into treasury.accounts (id, name, active, max_committed_bps, created_at)
       values ($1, 'Antiga', true, 5000, '2020-01-01'), ($2, 'Base', true, 8000, '2026-01-01')`,
      [OLD_ACTIVE, BASE_ACCOUNT_ID],
    );
    expect((await summary()).maxCommittedBps).toBe(8000);
  });

  it("the cap is null when the base account does not exist", async () => {
    await client.query(
      "insert into treasury.accounts (id, name, active, max_committed_bps) values ($1, 'A', true, 5000)",
      [OLD_ACTIVE],
    );
    expect((await summary()).maxCommittedBps).toBeNull();
  });
});
