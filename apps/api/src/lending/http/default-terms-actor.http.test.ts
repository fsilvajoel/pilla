import type { PGlite } from "@electric-sql/pglite";
import type { INestApplication } from "@nestjs/common";
import type { RequestActor } from "../../core/public/actor";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "../../core/http/test-app";
import { DATABASE } from "../../db/database";
import { migratedTestDb } from "../../db/test-db";
import { LoansService } from "../application/loans-service";
import { DefaultTermsController } from "./default-terms.controller";

const PREVIOUS_AUTHOR = "01970000-0000-7000-8000-000000000009";
const SEED_TERMS_ID = "01970000-0000-7000-8000-0000000000d1";
const ACTOR: RequestActor = { type: "ADMIN", adminUserId: "01970000-0000-7000-8000-000000000077", ip: "203.0.113.7" };
const NEW_TERMS = {
  lateFeeBps: 350,
  lateInterestMonthlyBps: 150,
  gracePeriodDays: 5,
  suggestedMonthlyRateBps: 800,
  roundingStepCents: 1000,
};

let client: PGlite;
let app: INestApplication;
let baseUrl: string;

beforeAll(async () => {
  const migrated = await migratedTestDb();
  client = migrated.client;
  app = await createTestApp([DefaultTermsController], [LoansService, { provide: DATABASE, useValue: migrated.db }], {
    actor: ACTOR,
  });
  baseUrl = await app.getUrl();
});
afterAll(async () => {
  await app.close();
  await client.close();
});
beforeEach(async () => {
  await client.query("delete from core.audit_log");
  await client.query("delete from core.outbox");
  await client.query("delete from lending.default_terms");
  await client.query(
    `insert into lending.default_terms
       (id, late_fee_bps, late_interest_monthly_bps, grace_period_days, suggested_monthly_rate_bps, rounding_step_cents, effective_from, created_by)
     values ($1, 200, 100, 0, 1000, 500, '2026-01-01T00:00:00Z', $2)`,
    [SEED_TERMS_ID, PREVIOUS_AUTHOR],
  );
});

type AuditRow = { actor_type: string; actor_id: string | null; ip: string | null };

describe("PUT /api/v1/settings/default-terms records the session admin (E14-F04, A4, A5)", () => {
  it("C10 (A4): the new row has created_by of the actor, not the author of the previous row", async () => {
    const res = await request(baseUrl).put("/api/v1/settings/default-terms").send(NEW_TERMS);
    expect(res.status).toBe(200);
    const rows = await client.query<{ id: string; created_by: string }>(
      "select id, created_by from lending.default_terms order by effective_from, id",
    );
    expect(rows.rows).toHaveLength(2);
    expect(rows.rows[0]).toEqual({ id: SEED_TERMS_ID, created_by: PREVIOUS_AUTHOR });
    expect(rows.rows[1]?.created_by).toBe(ACTOR.adminUserId);
  });

  it("C10 (A4): the audit row has actor ADMIN, the actor adminUserId and the actor ip", async () => {
    await request(baseUrl).put("/api/v1/settings/default-terms").send(NEW_TERMS);
    const audit = await client.query<AuditRow>(
      "select actor_type, actor_id, host(ip) as ip from core.audit_log where action = 'default_terms.updated'",
    );
    expect(audit.rows).toEqual([{ actor_type: "ADMIN", actor_id: ACTOR.adminUserId, ip: ACTOR.ip }]);
  });

  it("C11 (A5): the update writes no audit row with a null actor_id", async () => {
    await request(baseUrl).put("/api/v1/settings/default-terms").send(NEW_TERMS);
    const nulls = await client.query("select 1 from core.audit_log where actor_id is null");
    expect(nulls.rows).toHaveLength(0);
    const all = await client.query("select 1 from core.audit_log");
    expect(all.rows).toHaveLength(1);
  });
});
