import type { PGlite } from "@electric-sql/pglite";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { accountListResponse } from "@pilla/schemas";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../../app.module";
import { configureApp } from "../../core/http/configure-app";
import type { ApiEnv } from "../../core/http/env";
import { DATABASE_HANDLE } from "../../db/database";
import { migratedTestDb, type MigratedTestDb } from "../../db/test-db";
import { BASE_ACCOUNT_ID, BASE_ACCOUNT_NAME, seedBaseAccount } from "../infra/account-repository";

const INACTIVE_ID = "01970000-0000-7000-8000-000000000001";
const ACTIVE_ID = "01970000-0000-7000-8000-000000000002";

const env: ApiEnv = { host: "127.0.0.1", port: 3000, databaseUrl: "postgres://u:p@127.0.0.1:1/pilla" };

let handle: MigratedTestDb;
let client: PGlite;
let app: INestApplication;
let baseUrl: string;

beforeAll(async () => {
  handle = await migratedTestDb();
  client = handle.client;
  const moduleRef = await Test.createTestingModule({ imports: [AppModule.forRoot(env)] })
    .overrideProvider(DATABASE_HANDLE)
    .useValue({ db: handle.db, close: () => Promise.resolve() })
    .compile();
  app = moduleRef.createNestApplication();
  configureApp(app);
  await app.listen(0, "127.0.0.1");
  baseUrl = await app.getUrl();
});
afterAll(async () => {
  await app.close();
  await handle.close();
});
beforeEach(async () => {
  await client.query("delete from treasury.accounts");
});

async function getAccounts(): Promise<{ status: number; body: unknown }> {
  const res = await request(baseUrl).get("/api/v1/accounts");
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
      { id: ACTIVE_ID, name: "Atual", active: true },
      { id: INACTIVE_ID, name: "Antiga", active: false },
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
      { id: BASE_ACCOUNT_ID, name: BASE_ACCOUNT_NAME, active: true },
    ]);
    expect(BASE_ACCOUNT_NAME).toBe("Conta principal");
  });
});
