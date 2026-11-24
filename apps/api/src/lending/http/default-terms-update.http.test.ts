import type { PGlite } from "@electric-sql/pglite";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { defaultTermsResponse } from "@pilla/schemas";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { type AdminAgent, loginAsAdmin } from "../../core/http/test-admin-agent";
import { AppModule } from "../../app.module";
import { configureApp } from "../../core/http/configure-app";
import type { ApiEnv } from "../../core/http/env";
import { DATABASE_HANDLE } from "../../db/database";
import { migratedTestDb } from "../../db/test-db";

const PERSON_ID = "01970000-0000-7000-8000-000000000001";
const ADMIN_ID = "01970000-0000-7000-8000-000000000009";
const SEED_TERMS_ID = "01970000-0000-7000-8000-0000000000d1";
const env: ApiEnv = { host: "127.0.0.1", port: 3000, databaseUrl: "postgres://u:p@127.0.0.1:1/pilla" };

const SEED = {
  lateFeeBps: 200,
  lateInterestMonthlyBps: 100,
  gracePeriodDays: 0,
  suggestedMonthlyRateBps: 1000,
  roundingStepCents: 500,
};
const NEW_TERMS = {
  lateFeeBps: 350,
  lateInterestMonthlyBps: 150,
  gracePeriodDays: 5,
  suggestedMonthlyRateBps: 800,
  roundingStepCents: 1000,
};

type ProblemBody = { code?: string; errors?: { field: string }[] };
type LoanBody = {
  id: string;
  lateFeeBps: number;
  lateInterestMonthlyBps: number;
  gracePeriodDays: number;
  roundingStepCents: number;
};
type TermsDbRow = {
  id: string;
  late_fee_bps: number;
  late_interest_monthly_bps: number;
  grace_period_days: number;
  suggested_monthly_rate_bps: number;
  rounding_step_cents: number;
  effective_from: Date;
  created_by: string | null;
};
type AuditDbRow = {
  actor_type: string;
  action: string;
  entity_type: string;
  entity_id: string;
  before: unknown;
  after: unknown;
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
  await app.listen(0, "127.0.0.1");
  baseUrl = await app.getUrl();
  admin = await loginAsAdmin(baseUrl, client);
});
afterAll(async () => {
  await app.close();
  await client.close();
});
beforeEach(async () => {
  await client.query("drop trigger if exists fail_terms_audit on core.audit_log");
  await client.query("delete from core.audit_log");
  await client.query("delete from core.outbox");
  await client.query("delete from lending.loans");
  await client.query("delete from lending.loan_number_sequences");
  await client.query("delete from lending.default_terms");
  await client.query("delete from people.persons");
  await client.query(
    "insert into people.persons (id, full_name, cpf, phone) values ($1, 'Ana Souza', '52998224725', '+5511987654321')",
    [PERSON_ID],
  );
  await client.query(
    `insert into lending.default_terms
       (id, late_fee_bps, late_interest_monthly_bps, grace_period_days, suggested_monthly_rate_bps, rounding_step_cents, effective_from, created_by)
     values ($1, 200, 100, 0, 1000, 500, '2026-01-01T00:00:00Z', $2)`,
    [SEED_TERMS_ID, ADMIN_ID],
  );
});
afterEach(() => {
  vi.useRealTimers();
});

async function put(body: Record<string, unknown>): Promise<request.Response> {
  return admin.put("/api/v1/settings/default-terms").send(body);
}

async function termsRows(): Promise<TermsDbRow[]> {
  const result = await client.query<TermsDbRow>(
    "select id, late_fee_bps, late_interest_monthly_bps, grace_period_days, suggested_monthly_rate_bps, rounding_step_cents, effective_from, created_by from lending.default_terms order by effective_from, id",
  );
  return result.rows;
}

async function termsAudit(): Promise<AuditDbRow[]> {
  const result = await client.query<AuditDbRow>(
    "select actor_type, action, entity_type, entity_id, before, after from core.audit_log where action = 'default_terms.updated' order by at, id",
  );
  return result.rows;
}

function loanBodyFor(terms: typeof SEED): Record<string, unknown> {
  return {
    personId: PERSON_ID,
    type: "INSTALLMENT",
    principalCents: 500000,
    monthlyInterestRateBps: terms.suggestedMonthlyRateBps,
    installmentCount: 6,
    frequency: { unit: "MONTH", interval: 1 },
    firstDueDate: "2026-12-14",
    lateFeeBps: terms.lateFeeBps,
    lateInterestMonthlyBps: terms.lateInterestMonthlyBps,
    gracePeriodDays: terms.gracePeriodDays,
  };
}

describe("PUT /api/v1/settings/default-terms: update (E13-F01, A1 to A4)", () => {
  it("C1 (A1): answers 200 with the five new values in the defaultTermsResponse schema", async () => {
    const res = await put(NEW_TERMS);
    expect(res.status).toBe(200);
    expect(defaultTermsResponse.parse(res.body)).toEqual(NEW_TERMS);
  });

  it("C2 (A2): inserts a second row and leaves the first untouched", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-21T12:00:00Z"));
    const res = await put(NEW_TERMS);
    expect(res.status).toBe(200);
    const rows = await termsRows();
    expect(rows).toHaveLength(2);
    const [first, second] = rows;
    expect(first?.id).toBe(SEED_TERMS_ID);
    expect(first?.late_fee_bps).toBe(SEED.lateFeeBps);
    expect(first?.late_interest_monthly_bps).toBe(SEED.lateInterestMonthlyBps);
    expect(first?.grace_period_days).toBe(SEED.gracePeriodDays);
    expect(first?.suggested_monthly_rate_bps).toBe(SEED.suggestedMonthlyRateBps);
    expect(first?.rounding_step_cents).toBe(SEED.roundingStepCents);
    expect(first?.effective_from.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(second?.late_fee_bps).toBe(NEW_TERMS.lateFeeBps);
    expect(second?.late_interest_monthly_bps).toBe(NEW_TERMS.lateInterestMonthlyBps);
    expect(second?.grace_period_days).toBe(NEW_TERMS.gracePeriodDays);
    expect(second?.suggested_monthly_rate_bps).toBe(NEW_TERMS.suggestedMonthlyRateBps);
    expect(second?.rounding_step_cents).toBe(NEW_TERMS.roundingStepCents);
    expect(second?.effective_from.toISOString()).toBe("2026-11-21T12:00:00.000Z");
    expect(second?.created_by).not.toBeNull();
  });

  it("C3 (A3): the GET right after returns the new values", async () => {
    await put(NEW_TERMS);
    const res = await admin.get("/api/v1/settings/default-terms");
    expect(res.status).toBe(200);
    expect(res.body).toEqual(NEW_TERMS);
  });

  it("C4 (A4): two PUTs in a row leave the last one current, with three rows", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-21T12:00:00Z"));
    await put(NEW_TERMS);
    vi.setSystemTime(new Date("2026-11-21T12:00:05Z"));
    const last = { ...NEW_TERMS, lateFeeBps: 400, roundingStepCents: 250 };
    const res = await put(last);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(last);
    expect(await termsRows()).toHaveLength(3);
    const current = await admin.get("/api/v1/settings/default-terms");
    expect(current.body).toEqual(last);
  });

  it("C5: the answer has exactly the five schema keys", async () => {
    const res = await put(NEW_TERMS);
    expect(Object.keys(res.body as object).sort()).toEqual(Object.keys(NEW_TERMS).sort());
  });

  it("C6: grace period 0 is accepted", async () => {
    const res = await put({ ...NEW_TERMS, gracePeriodDays: 0 });
    expect(res.status).toBe(200);
    expect((res.body as typeof NEW_TERMS).gracePeriodDays).toBe(0);
  });
});

describe("PUT /api/v1/settings/default-terms: audit (A5)", () => {
  it("C7: writes one default_terms.updated row per change", async () => {
    await put(NEW_TERMS);
    await put({ ...NEW_TERMS, lateFeeBps: 400 });
    const audit = await termsAudit();
    expect(audit).toHaveLength(2);
    expect(audit.map((row) => row.entity_type)).toEqual(["default_terms", "default_terms"]);
    expect(audit.map((row) => row.actor_type)).toEqual(["ADMIN", "ADMIN"]);
  });

  it("C8: before holds the terms current before the PUT and after holds the new ones", async () => {
    await put(NEW_TERMS);
    const audit = await termsAudit();
    expect(audit).toHaveLength(1);
    expect(audit[0]?.before).toMatchObject(SEED);
    expect(audit[0]?.after).toMatchObject(NEW_TERMS);
    const rows = await termsRows();
    expect(audit[0]?.entity_id).toBe(rows[1]?.id);
  });

  it("C9: a failing audit insert rolls back the new default_terms row", async () => {
    await client.query(
      `create or replace function core.fail_terms_audit() returns trigger language plpgsql as
       $$ begin raise exception 'audit failed'; end $$`,
    );
    await client.query(
      `create trigger fail_terms_audit before insert on core.audit_log
       for each row when (new.action = 'default_terms.updated') execute function core.fail_terms_audit()`,
    );
    const res = await put(NEW_TERMS);
    expect(res.status).toBe(500);
    const rows = await termsRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(SEED_TERMS_ID);
    const current = await admin.get("/api/v1/settings/default-terms");
    expect(current.body).toEqual(SEED);
  });
});

describe("PUT /api/v1/settings/default-terms: loans created before and after (A6, A7, CA-10)", () => {
  it("C10 (A6): a loan created before the PUT keeps its late fee, late interest, grace and rounding step", async () => {
    const created = await admin.post("/api/v1/loans").send(loanBodyFor(SEED));
    expect(created.status).toBe(201);
    const before = created.body as LoanBody;
    await put(NEW_TERMS);
    const res = await admin.get(`/api/v1/loans/${before.id}`);
    expect(res.status).toBe(200);
    const loan = res.body as LoanBody;
    expect(loan.lateFeeBps).toBe(SEED.lateFeeBps);
    expect(loan.lateInterestMonthlyBps).toBe(SEED.lateInterestMonthlyBps);
    expect(loan.gracePeriodDays).toBe(SEED.gracePeriodDays);
    expect(loan.roundingStepCents).toBe(SEED.roundingStepCents);
  });

  it("C11 (A6): the stored loan row is untouched by the PUT", async () => {
    const created = await admin.post("/api/v1/loans").send(loanBodyFor(SEED));
    const id = (created.body as LoanBody).id;
    const stored = await client.query("select * from lending.loans where id = $1", [id]);
    await put(NEW_TERMS);
    const after = await client.query("select * from lending.loans where id = $1", [id]);
    expect(after.rows).toEqual(stored.rows);
  });

  it("C12 (A7): a loan created after the PUT, prefilled from the GET, carries the new values", async () => {
    await put(NEW_TERMS);
    const terms = await admin.get("/api/v1/settings/default-terms");
    const created = await admin.post("/api/v1/loans").send(loanBodyFor(terms.body as typeof SEED));
    expect(created.status).toBe(201);
    const loan = created.body as LoanBody;
    expect(loan.lateFeeBps).toBe(NEW_TERMS.lateFeeBps);
    expect(loan.lateInterestMonthlyBps).toBe(NEW_TERMS.lateInterestMonthlyBps);
    expect(loan.gracePeriodDays).toBe(NEW_TERMS.gracePeriodDays);
  });

  it("C13 (A7): the rounding step is copied from the new terms on creation", async () => {
    await put(NEW_TERMS);
    const created = await admin.post("/api/v1/loans").send(loanBodyFor(NEW_TERMS));
    expect(created.status).toBe(201);
    expect((created.body as LoanBody).roundingStepCents).toBe(NEW_TERMS.roundingStepCents);
  });
});

describe("PUT /api/v1/settings/default-terms: invalid body and equal values (A8, A9)", () => {
  it("C14: a missing field answers 400 VALIDATION_FAILED naming it, writing nothing", async () => {
    const partial = { ...NEW_TERMS, roundingStepCents: undefined };
    const res = await put(partial);
    const body = res.body as ProblemBody;
    expect(res.status).toBe(400);
    expect(body.code).toBe("VALIDATION_FAILED");
    expect(body.errors?.map((e) => e.field)).toEqual(["roundingStepCents"]);
    expect(await termsRows()).toHaveLength(1);
  });

  it("C15: a negative value answers 400 VALIDATION_FAILED on the field", async () => {
    const res = await put({ ...NEW_TERMS, lateFeeBps: -1 });
    const body = res.body as ProblemBody;
    expect(res.status).toBe(400);
    expect(body.code).toBe("VALIDATION_FAILED");
    expect(body.errors?.map((e) => e.field)).toEqual(["lateFeeBps"]);
    expect(await termsRows()).toHaveLength(1);
  });

  it("C16: an unknown key answers 400 VALIDATION_FAILED", async () => {
    const res = await put({ ...NEW_TERMS, effectiveFrom: "2027-01-01T00:00:00Z" });
    expect(res.status).toBe(400);
    expect((res.body as ProblemBody).code).toBe("VALIDATION_FAILED");
    expect(await termsRows()).toHaveLength(1);
  });

  it("C16: values above the limits answer 400 VALIDATION_FAILED on each field", async () => {
    const res = await put({
      lateFeeBps: 10001,
      lateInterestMonthlyBps: 10001,
      gracePeriodDays: 366,
      suggestedMonthlyRateBps: 10001,
      roundingStepCents: 100001,
    });
    const body = res.body as ProblemBody;
    expect(res.status).toBe(400);
    expect(body.errors?.map((e) => e.field).sort()).toEqual(
      [
        "gracePeriodDays",
        "lateFeeBps",
        "lateInterestMonthlyBps",
        "roundingStepCents",
        "suggestedMonthlyRateBps",
      ].sort(),
    );
  });

  it("C19 (A9): a PUT equal to the current terms answers 200 with no new row and no audit", async () => {
    const res = await put(SEED);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(SEED);
    expect(await termsRows()).toHaveLength(1);
    expect(await termsAudit()).toHaveLength(0);
  });

  it("C20: with no default terms row at all answers 404 NOT_FOUND and writes nothing", async () => {
    await client.query("delete from lending.default_terms");
    const res = await put(NEW_TERMS);
    expect(res.status).toBe(404);
    expect((res.body as ProblemBody).code).toBe("NOT_FOUND");
    expect(await termsRows()).toHaveLength(0);
  });
});
