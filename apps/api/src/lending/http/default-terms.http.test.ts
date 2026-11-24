import type { PGlite } from "@electric-sql/pglite";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { defaultTermsResponse } from "@pilla/schemas";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { type AdminAgent, loginAsAdmin } from "../../core/http/test-admin-agent";
import { AppModule } from "../../app.module";
import { configureApp } from "../../core/http/configure-app";
import type { ApiEnv } from "../../core/http/env";
import { DATABASE_HANDLE } from "../../db/database";
import { migratedTestDb } from "../../db/test-db";

const ADMIN_ID = "01970000-0000-7000-8000-000000000009";
const env: ApiEnv = { host: "127.0.0.1", port: 3000, databaseUrl: "postgres://u:p@127.0.0.1:1/pilla" };

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
  await app.listen(0, "127.0.0.1");
  baseUrl = await app.getUrl();
  admin = await loginAsAdmin(baseUrl, client);
});
afterAll(async () => {
  await app.close();
  await client.close();
});
beforeEach(async () => {
  await client.query("delete from lending.default_terms");
});

async function seedTerms(id: string, effectiveFrom: string, lateFeeBps: number, roundingStep: number): Promise<void> {
  await client.query(
    `insert into lending.default_terms
       (id, late_fee_bps, late_interest_monthly_bps, grace_period_days, suggested_monthly_rate_bps, rounding_step_cents, effective_from, created_by)
     values ($1, $2, 100, 3, 1000, $3, $4, $5)`,
    [id, lateFeeBps, roundingStep, effectiveFrom, ADMIN_ID],
  );
}

describe("GET /api/v1/settings/default-terms (E10-F03, A10)", () => {
  it("C17: answers the row with the greatest effective_from in the defaultTermsResponse schema", async () => {
    await seedTerms("01970000-0000-7000-8000-000000000001", "2026-01-01T00:00:00Z", 200, 500);
    await seedTerms("01970000-0000-7000-8000-000000000002", "2026-06-01T00:00:00Z", 350, 1000);
    const res = await admin.get("/api/v1/settings/default-terms");
    expect(res.status).toBe(200);
    expect(defaultTermsResponse.parse(res.body)).toEqual({
      lateFeeBps: 350,
      lateInterestMonthlyBps: 100,
      gracePeriodDays: 3,
      suggestedMonthlyRateBps: 1000,
      roundingStepCents: 1000,
    });
  });

  it("answers 404 NOT_FOUND when there is no default terms row", async () => {
    const res = await admin.get("/api/v1/settings/default-terms");
    expect(res.status).toBe(404);
    expect((res.body as { code: string }).code).toBe("NOT_FOUND");
  });
});
