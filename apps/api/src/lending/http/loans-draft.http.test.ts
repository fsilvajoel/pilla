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

const PERSON_ID = "01970000-0000-7000-8000-000000000001";
const OTHER_PERSON_ID = "01970000-0000-7000-8000-000000000002";
const UNKNOWN_PERSON_ID = "01970000-0000-7000-8000-000000000099";
const ADMIN_ID = "01970000-0000-7000-8000-000000000009";
const ACTIVE_LOAN_ID = "01970000-0000-7000-8000-0000000000a1";
const CANCELLED_LOAN_ID = "01970000-0000-7000-8000-0000000000a2";
const UNKNOWN_LOAN_ID = "01970000-0000-7000-8000-0000000000ff";

const env: ApiEnv = {
  host: "127.0.0.1",
  port: 3000,
  databaseUrl: "postgres://u:p@127.0.0.1:1/pilla",
  accessHashKey: "chave-de-teste-do-hash-com-mais-de-32-caracteres",
};

const validBody = {
  personId: PERSON_ID,
  type: "INSTALLMENT",
  principalCents: 500000,
  monthlyInterestRateBps: 633,
  installmentCount: 6,
  frequency: { unit: "MONTH", interval: 1 },
  firstDueDate: "2026-12-14",
  lateFeeBps: 250,
  lateInterestMonthlyBps: 120,
  gracePeriodDays: 0,
};

type LoanBody = {
  id: string;
  loanNumber: string;
  status: string;
  version: number;
  accountId: string | null;
  principalCents: number;
  installmentCount: number;
  lateFeeBps: number;
  lateInterestMonthlyBps: number;
  gracePeriodDays: number;
  roundingStepCents: number;
  warning?: { activeLoansCount: number };
  code?: string;
  errors?: { field: string }[];
};
type LoanDbRow = {
  status: string;
  version: number;
  account_id: string | null;
  principal_cents: number;
  grace_period_days: number;
  rounding_step_cents: number;
  late_fee_bps: number;
  status_changed_at: Date;
  created_at: Date;
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
  await client.query("delete from core.audit_log");
  await client.query("delete from core.outbox");
  await client.query("delete from lending.loans");
  await client.query("delete from lending.loan_number_sequences");
  await client.query("delete from lending.default_terms");
  await client.query("delete from people.persons");
  await client.query(
    `insert into people.persons (id, full_name, cpf, phone) values
       ($1, 'Ana Souza', '52998224725', '+5511987654321'),
       ($2, 'José Lima', '11144477735', '+5511987654322')`,
    [PERSON_ID, OTHER_PERSON_ID],
  );
  await client.query(
    `insert into lending.default_terms
       (id, late_fee_bps, late_interest_monthly_bps, grace_period_days, suggested_monthly_rate_bps, rounding_step_cents, effective_from, created_by)
     values ('01970000-0000-7000-8000-0000000000d1', 200, 100, 0, 1000, 500, '2026-01-01T00:00:00Z', $1)`,
    [ADMIN_ID],
  );
});
afterEach(() => {
  vi.useRealTimers();
});

async function seedLoan(id: string, loanNumber: string, status: string, personId = PERSON_ID): Promise<void> {
  const settled = status === "DRAFT" || status === "CANCELLED";
  await client.query(
    `insert into lending.loans
       (id, loan_number, person_id, type, status, principal_cents, monthly_interest_rate_bps, installment_count,
        frequency_unit, frequency_interval, first_due_date, contracted_at, disbursed_at, account_id,
        late_fee_bps, late_interest_monthly_bps, grace_period_days, rounding_step_cents)
     values ($1, $2, $3, 'INSTALLMENT', $4, 100000, 500, 3, 'MONTH', 1, '2026-12-14', '2026-11-20', $5, $6,
        200, 100, 0, 500)`,
    [
      id,
      loanNumber,
      personId,
      status,
      settled ? null : "2026-11-20",
      settled ? null : "01970000-0000-7000-8000-0000000000b1",
    ],
  );
}

async function createDraft(): Promise<LoanBody> {
  const res = await admin.post("/api/v1/loans").send(validBody);
  expect(res.status).toBe(201);
  return res.body as LoanBody;
}

async function dbLoan(id: string): Promise<LoanDbRow | undefined> {
  const result = await client.query<LoanDbRow>(
    `select status, version, account_id, principal_cents, grace_period_days, rounding_step_cents, late_fee_bps,
            status_changed_at, created_at
     from lending.loans where id = $1`,
    [id],
  );
  return result.rows[0];
}

async function auditActions(entityId: string): Promise<string[]> {
  const result = await client.query<{ action: string }>(
    "select action from core.audit_log where entity_id = $1 order by at, id",
    [entityId],
  );
  return result.rows.map((row) => row.action);
}

describe("POST /api/v1/loans (E10-F03, A1 to A4)", () => {
  it("C1 (A1): answers 201 DRAFT with number AAAA-NNNN, no account and the three charges", async () => {
    const res = await admin.post("/api/v1/loans").send(validBody);
    const body = res.body as LoanBody;
    expect(res.status).toBe(201);
    expect(body.status).toBe("DRAFT");
    expect(body.loanNumber).toMatch(/^\d{4}-\d{4}$/);
    expect(body.accountId).toBeNull();
    expect(body.version).toBe(1);
    expect(body.principalCents).toBe(500000);
    expect(body.lateFeeBps).toBe(250);
    expect(body.lateInterestMonthlyBps).toBe(120);
    expect(res.headers.location).toBe(`/api/v1/loans/${body.id}`);
    const row = await dbLoan(body.id);
    expect(row?.status).toBe("DRAFT");
    expect(row?.account_id).toBeNull();
  });

  it("C2 (A2): copies grace_period_days and rounding_step from default_terms (ADR-0008)", async () => {
    await client.query("update lending.default_terms set rounding_step_cents = 1000");
    const body = await createDraft();
    expect(body.roundingStepCents).toBe(1000);
    expect(body.gracePeriodDays).toBe(0);
    const row = await dbLoan(body.id);
    expect(row?.rounding_step_cents).toBe(1000);
    expect(row?.grace_period_days).toBe(0);
  });

  it("C3 (A3): unknown personId answers 400 VALIDATION_FAILED (catalog status) on personId, writing nothing", async () => {
    const res = await admin.post("/api/v1/loans").send({ ...validBody, personId: UNKNOWN_PERSON_ID });
    const body = res.body as LoanBody;
    expect(res.status).toBe(400);
    expect(body.code).toBe("VALIDATION_FAILED");
    expect(body.errors?.map((e) => e.field)).toEqual(["personId"]);
    const count = await client.query("select 1 from lending.loans");
    expect(count.rows).toHaveLength(0);
  });

  it("C4: principal zero answers 400 VALIDATION_FAILED on principalCents", async () => {
    const res = await admin.post("/api/v1/loans").send({ ...validBody, principalCents: 0 });
    expect(res.status).toBe(400);
    expect((res.body as LoanBody).errors?.map((e) => e.field)).toEqual(["principalCents"]);
  });

  it("C5: invalid installment count answers 400 VALIDATION_FAILED on installmentCount", async () => {
    const res = await admin.post("/api/v1/loans").send({ ...validBody, type: "SINGLE_PAYMENT", installmentCount: 3 });
    expect(res.status).toBe(400);
    expect((res.body as LoanBody).errors?.map((e) => e.field)).toEqual(["installmentCount"]);
  });

  it("C6 (D10): INTEREST_ONLY is refused with VALIDATION_FAILED on type", async () => {
    const res = await admin.post("/api/v1/loans").send({ ...validBody, type: "INTEREST_ONLY" });
    expect(res.status).toBe(400);
    expect((res.body as LoanBody).errors?.map((e) => e.field)).toEqual(["type"]);
  });

  it("C7: numbers follow the yearly sequence, in the same transaction as the insert", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-20T15:00:00Z"));
    await client.query("insert into lending.loan_number_sequences (year, last_value) values (2026, 41)");
    const first = await createDraft();
    const second = await createDraft();
    expect([first.loanNumber, second.loanNumber]).toEqual(["2026-0042", "2026-0043"]);
    const seq = await client.query<{ last_value: number }>(
      "select last_value from lending.loan_number_sequences where year = 2026",
    );
    expect(seq.rows[0]?.last_value).toBe(43);
  });

  it("C8 (RN-C11): the response warns with the count of active loans of the person", async () => {
    await seedLoan(ACTIVE_LOAN_ID, "2026-0900", "ACTIVE");
    await seedLoan(CANCELLED_LOAN_ID, "2026-0901", "CANCELLED");
    const withActive = await admin.post("/api/v1/loans").send(validBody);
    expect((withActive.body as LoanBody).warning).toEqual({ activeLoansCount: 1 });
    const other = await admin.post("/api/v1/loans").send({ ...validBody, personId: OTHER_PERSON_ID });
    expect((other.body as LoanBody).warning).toEqual({ activeLoansCount: 0 });
  });

  it("A4: writes exactly one audit row for the creation", async () => {
    const body = await createDraft();
    const actions = await auditActions(body.id);
    expect(actions).toHaveLength(1);
  });
});

describe("PATCH /api/v1/loans/{id} (E10-F03, A5 to A7)", () => {
  const patch = (id: string, version: string | undefined, payload: object) => {
    const req = admin.patch(`/api/v1/loans/${id}`);
    return (version === undefined ? req : req.set("If-Match", version)).send(payload);
  };

  it("C9 (A5): changes a DRAFT with If-Match and bumps the version", async () => {
    const draft = await createDraft();
    const res = await patch(draft.id, "1", { principalCents: 750000, lateFeeBps: 300 });
    const body = res.body as LoanBody;
    expect(res.status).toBe(200);
    expect(body.principalCents).toBe(750000);
    expect(body.lateFeeBps).toBe(300);
    expect(body.version).toBe(2);
    const row = await dbLoan(draft.id);
    expect([row?.principal_cents, row?.late_fee_bps, row?.version]).toEqual([750000, 300, 2]);
  });

  it("C9: accepts the quoted version form of If-Match and writes an audit row", async () => {
    const draft = await createDraft();
    const res = await patch(draft.id, '"1"', { gracePeriodDays: 5 });
    expect(res.status).toBe(200);
    expect(await auditActions(draft.id)).toHaveLength(2);
  });

  it("C10: without If-Match answers 409 VERSION_CONFLICT and changes nothing", async () => {
    const draft = await createDraft();
    const res = await patch(draft.id, undefined, { principalCents: 750000 });
    expect(res.status).toBe(409);
    expect((res.body as LoanBody).code).toBe("VERSION_CONFLICT");
    expect((await dbLoan(draft.id))?.principal_cents).toBe(500000);
  });

  it("C11 (A6): wrong version answers 409 VERSION_CONFLICT", async () => {
    const draft = await createDraft();
    const res = await patch(draft.id, "7", { principalCents: 750000 });
    expect(res.status).toBe(409);
    expect((res.body as LoanBody).code).toBe("VERSION_CONFLICT");
    expect((await dbLoan(draft.id))?.version).toBe(1);
  });

  it("C12 (A7): an ACTIVE loan answers LOAN_NOT_EDITABLE", async () => {
    await seedLoan(ACTIVE_LOAN_ID, "2026-0900", "ACTIVE");
    const res = await patch(ACTIVE_LOAN_ID, "1", { principalCents: 750000 });
    expect(res.status).toBe(422);
    expect((res.body as LoanBody).code).toBe("LOAN_NOT_EDITABLE");
    expect((await dbLoan(ACTIVE_LOAN_ID))?.principal_cents).toBe(100000);
  });

  it("C13 (A7): a CANCELLED loan answers LOAN_NOT_EDITABLE", async () => {
    await seedLoan(CANCELLED_LOAN_ID, "2026-0901", "CANCELLED");
    const res = await patch(CANCELLED_LOAN_ID, "1", { principalCents: 750000 });
    expect(res.status).toBe(422);
    expect((res.body as LoanBody).code).toBe("LOAN_NOT_EDITABLE");
  });

  it("rejects personId in the body and answers 404 for an unknown loan", async () => {
    const draft = await createDraft();
    const withPerson = await patch(draft.id, "1", { personId: OTHER_PERSON_ID });
    expect(withPerson.status).toBe(400);
    expect((withPerson.body as LoanBody).code).toBe("VALIDATION_FAILED");
    const missing = await patch(UNKNOWN_LOAN_ID, "1", { principalCents: 750000 });
    expect(missing.status).toBe(404);
  });
});

describe("POST /api/v1/loans/{id}/cancel (E10-F03, A8 and A9)", () => {
  const cancel = (id: string, version: string | undefined) => {
    const req = admin.post(`/api/v1/loans/${id}/cancel`);
    return version === undefined ? req.send() : req.set("If-Match", version).send();
  };

  it("C14 (A8): a DRAFT becomes CANCELLED with status_changed_at and no outbox row", async () => {
    const draft = await createDraft();
    const before = await dbLoan(draft.id);
    const res = await cancel(draft.id, "1");
    const body = res.body as LoanBody;
    expect(res.status).toBe(200);
    expect(body.status).toBe("CANCELLED");
    expect(body.version).toBe(2);
    const after = await dbLoan(draft.id);
    expect(after?.status).toBe("CANCELLED");
    expect((after?.status_changed_at.getTime() ?? 0) >= (before?.status_changed_at.getTime() ?? 0)).toBe(true);
    const outbox = await client.query("select 1 from core.outbox");
    expect(outbox.rows).toHaveLength(0);
  });

  it("C15 (A9): an ACTIVE loan answers LOAN_NOT_EDITABLE and stays ACTIVE", async () => {
    await seedLoan(ACTIVE_LOAN_ID, "2026-0900", "ACTIVE");
    const res = await cancel(ACTIVE_LOAN_ID, "1");
    expect(res.status).toBe(422);
    expect((res.body as LoanBody).code).toBe("LOAN_NOT_EDITABLE");
    expect((await dbLoan(ACTIVE_LOAN_ID))?.status).toBe("ACTIVE");
  });

  it("C16 (A8): writes an audit row for the cancellation, after the creation row", async () => {
    const draft = await createDraft();
    await cancel(draft.id, "1");
    const actions = await auditActions(draft.id);
    expect(actions).toHaveLength(2);
    expect(actions[1]).not.toBe(actions[0]);
  });

  it("answers 409 VERSION_CONFLICT on a wrong version and 404 on an unknown loan", async () => {
    const draft = await createDraft();
    const stale = await cancel(draft.id, "9");
    expect(stale.status).toBe(409);
    expect((await dbLoan(draft.id))?.status).toBe("DRAFT");
    expect((await cancel(UNKNOWN_LOAN_ID, "1")).status).toBe(404);
  });
});
