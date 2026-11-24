import type { PGlite } from "@electric-sql/pglite";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type AdminAgent, loginAsAdmin } from "../../core/http/test-admin-agent";
import { AppModule } from "../../app.module";
import { configureApp } from "../../core/http/configure-app";
import type { ApiEnv } from "../../core/http/env";
import { DATABASE_HANDLE } from "../../db/database";
import { migratedTestDb } from "../../db/test-db";

const env: ApiEnv = { host: "127.0.0.1", port: 3000, databaseUrl: "postgres://u:p@127.0.0.1:1/pilla" };
const uuid = (n: number): string => `01970000-0000-7000-8000-${String(1000000000000 + n).slice(1)}`;
const ACCOUNT = uuid(1);
const OTHER = uuid(2);
const OTHER_ENTRY = uuid(50);

let client: PGlite;
let admin: AdminAgent;
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
  admin = await loginAsAdmin(baseUrl, client);
  await client.query("insert into treasury.accounts (id, name) values ($1, 'A'), ($2, 'B')", [ACCOUNT, OTHER]);
  await client.query(
    `insert into treasury.ledger_entries (id, account_id, type, amount_cents, entry_date, created_by)
     values ($1, $2, 'CAPITAL_IN', 100, '2026-01-10', $3)`,
    [OTHER_ENTRY, OTHER, uuid(9)],
  );
});
afterAll(async () => {
  await app.close();
  await client.close();
});

describe("GET /api/v1/accounts/{id}/entries cursor", () => {
  it.each([uuid(777), OTHER_ENTRY])(
    "refuses a well-formed cursor that is not an entry of the account (%s)",
    async (id) => {
      const cursor = Buffer.from(id, "utf8").toString("base64url");
      const res = await admin.get(`/api/v1/accounts/${ACCOUNT}/entries?cursor=${cursor}`);
      expect(res.status).toBe(400);
      expect((res.body as { code: string }).code).toBe("VALIDATION_FAILED");
    },
  );
});
