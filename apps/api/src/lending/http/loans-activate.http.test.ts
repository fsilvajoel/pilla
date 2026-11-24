import type { PGlite } from "@electric-sql/pglite";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { loanActivatedV1, loanRenegotiatedV1, loanRenewedV1 } from "@pilla/schemas";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { type AdminAgent, loginAsAdmin } from "../../core/http/test-admin-agent";
import { AppModule } from "../../app.module";
import { configureApp } from "../../core/http/configure-app";
import type { ApiEnv } from "../../core/http/env";
import { DATABASE_HANDLE } from "../../db/database";
import { migratedTestDb } from "../../db/test-db";

const PERSON_ID = "01970000-0000-7000-8000-000000000001";
const ACCOUNT_ID = "01970000-0000-7000-8000-0000000000b1";
const INACTIVE_ACCOUNT_ID = "01970000-0000-7000-8000-0000000000b2";
const UNKNOWN_ACCOUNT_ID = "01970000-0000-7000-8000-0000000000b9";
const DRAFT_ID = "01970000-0000-7000-8000-0000000000c1";
const ORIGIN_ID = "01970000-0000-7000-8000-0000000000c2";
const UNKNOWN_LOAN_ID = "01970000-0000-7000-8000-0000000000ff";

const env: ApiEnv = {
  host: "127.0.0.1",
  port: 3000,
  databaseUrl: "postgres://u:p@127.0.0.1:1/pilla",
  accessHashKey: "chave-de-teste-do-hash-com-mais-de-32-caracteres",
};

// CA-01 (T-14): 5.000,00 a 6,33% em 6 parcelas mensais; primeiro vencimento 2026-12-14.
const DISBURSED_AT = "2026-11-14";
const CA01_PRINCIPAL = [83333, 83333, 83333, 83333, 83333, 83335];
const CA01_INTEREST = [31667, 31667, 31667, 31667, 31667, 31665];
const CA01_DUE_DATES = ["2026-12-14", "2027-01-14", "2027-02-14", "2027-03-14", "2027-04-14", "2027-05-14"];

type LoanBody = {
  id: string;
  status: string;
  version: number;
  accountId: string | null;
  disbursedAt: string | null;
  code?: string;
  errors?: { field: string }[];
};
type LoanDbRow = {
  status: string;
  version: number;
  account_id: string | null;
  disbursed_at: string | null;
};
type InstallmentDbRow = {
  number: number;
  due_date: string;
  principal_cents: number;
  interest_cents: number;
  total_cents: number;
};
type OutboxDbRow = {
  event_type: string;
  event_version: number;
  aggregate_id: string;
  payload: unknown;
  occurred_at: Date;
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
  admin = await loginAsAdmin(baseUrl, client);
});
afterAll(async () => {
  await app.close();
  await client.close();
});
beforeEach(async () => {
  await client.query("delete from core.audit_log");
  await client.query("delete from core.outbox");
  await client.query("delete from lending.installments");
  await client.query("delete from lending.loans");
  await client.query("delete from treasury.accounts");
  await client.query("delete from people.persons");
  await client.query(
    `insert into people.persons (id, full_name, cpf, phone) values ($1, 'Ana Souza', '52998224725', '+5511987654321')`,
    [PERSON_ID],
  );
  await client.query(
    `insert into treasury.accounts (id, name, active) values ($1, 'Conta ativa', true), ($2, 'Conta inativa', false)`,
    [ACCOUNT_ID, INACTIVE_ACCOUNT_ID],
  );
});

async function seedLoan(
  id: string,
  loanNumber: string,
  status: string,
  origin?: { loanId: string; type: "RENEWAL" | "RENEGOTIATION" },
  capitalizedCents = 0,
  shape: { type: string; installmentCount: number | null; unit?: string } = {
    type: "INSTALLMENT",
    installmentCount: 6,
  },
): Promise<void> {
  const settled = status === "DRAFT" || status === "CANCELLED";
  await client.query(
    `insert into lending.loans
       (id, loan_number, person_id, type, status, principal_cents, monthly_interest_rate_bps, installment_count,
        frequency_unit, frequency_interval, first_due_date, contracted_at, disbursed_at, account_id,
        origin_loan_id, origin_type, capitalized_amount_cents,
        late_fee_bps, late_interest_monthly_bps, grace_period_days, rounding_step_cents)
     values ($1, $2, $3, $10, $4, 500000, 633, $11, $12, 1, '2026-12-14', '2026-11-10', $5, $6,
        $7, $8, $9, 250, 120, 0, 500)`,
    [
      id,
      loanNumber,
      PERSON_ID,
      status,
      settled ? null : "2026-10-01",
      settled ? null : ACCOUNT_ID,
      origin?.loanId ?? null,
      origin?.type ?? null,
      capitalizedCents,
      shape.type,
      shape.installmentCount,
      shape.unit ?? "MONTH",
    ],
  );
}

function activate(id: string, version: string | undefined, payload: object) {
  const req = admin.post(`/api/v1/loans/${id}/activate`);
  return (version === undefined ? req : req.set("If-Match", version)).send(payload);
}

const goodBody = { disbursedAt: DISBURSED_AT, accountId: ACCOUNT_ID };

async function dbLoan(id: string): Promise<LoanDbRow | undefined> {
  const result = await client.query<LoanDbRow>(
    "select status, version, account_id, to_char(disbursed_at, 'YYYY-MM-DD') as disbursed_at from lending.loans where id = $1",
    [id],
  );
  return result.rows[0];
}

async function dbInstallments(id: string): Promise<InstallmentDbRow[]> {
  const result = await client.query<InstallmentDbRow>(
    `select number, to_char(due_date, 'YYYY-MM-DD') as due_date, principal_cents, interest_cents, total_cents
     from lending.installments where loan_id = $1 order by number`,
    [id],
  );
  return result.rows;
}

async function outbox(): Promise<OutboxDbRow[]> {
  const result = await client.query<OutboxDbRow>(
    "select event_type, event_version, aggregate_id, payload, occurred_at from core.outbox order by event_type",
  );
  return result.rows;
}

async function auditActions(): Promise<string[]> {
  const result = await client.query<{ action: string }>("select action from core.audit_log order by action");
  return result.rows.map((row) => row.action);
}

async function expectNothingWritten(id: string, status: string, version: number): Promise<void> {
  expect(await dbLoan(id)).toMatchObject({ status, version });
  expect(await dbInstallments(id)).toHaveLength(0);
  expect(await outbox()).toHaveLength(0);
  expect(await auditActions()).toHaveLength(0);
}

describe("POST /api/v1/loans/{id}/activate: feliz (E10-F04, A1 a A3)", () => {
  it("C1 (A1): DRAFT becomes ACTIVE with disbursed_at, account_id and a bumped version", async () => {
    await seedLoan(DRAFT_ID, "2026-0001", "DRAFT");
    const res = await activate(DRAFT_ID, "1", goodBody);
    const body = res.body as LoanBody;
    expect(res.status).toBe(200);
    expect(body.status).toBe("ACTIVE");
    expect(body.disbursedAt).toBe(DISBURSED_AT);
    expect(body.accountId).toBe(ACCOUNT_ID);
    expect(body.version).toBe(2);
    expect(await dbLoan(DRAFT_ID)).toEqual({
      status: "ACTIVE",
      version: 2,
      account_id: ACCOUNT_ID,
      disbursed_at: DISBURSED_AT,
    });
  });

  it("C2 (A2): installments equal the CA-01 schedule of @pilla/finance (T-14)", async () => {
    await seedLoan(DRAFT_ID, "2026-0001", "DRAFT");
    await activate(DRAFT_ID, "1", goodBody);
    const rows = await dbInstallments(DRAFT_ID);
    expect(rows.map((r) => r.number)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(rows.map((r) => r.due_date)).toEqual(CA01_DUE_DATES);
    expect(rows.map((r) => r.principal_cents)).toEqual(CA01_PRINCIPAL);
    expect(rows.map((r) => r.interest_cents)).toEqual(CA01_INTEREST);
    expect(rows.map((r) => r.total_cents)).toEqual([115000, 115000, 115000, 115000, 115000, 115000]);
  });

  it("C3 (A3): writes one LoanActivated that parses with the Zod of packages/schemas/src/events", async () => {
    await seedLoan(DRAFT_ID, "2026-0001", "DRAFT");
    await activate(DRAFT_ID, "1", goodBody);
    const events = await outbox();
    expect(events).toHaveLength(1);
    const [event] = events;
    expect(event?.event_type).toBe("LoanActivated");
    expect(event?.event_version).toBe(1);
    expect(event?.aggregate_id).toBe(DRAFT_ID);
    const parsed = loanActivatedV1.safeParse({
      id: "01970000-0000-7000-8000-0000000000e1",
      type: event?.event_type,
      version: event?.event_version,
      occurredAt: event?.occurred_at.toISOString(),
      aggregateId: event?.aggregate_id,
      payload: event?.payload,
    });
    expect(parsed.success).toBe(true);
    expect(event?.payload).toEqual({
      loanId: DRAFT_ID,
      personId: PERSON_ID,
      accountId: ACCOUNT_ID,
      principalCents: 500000,
      disbursedAt: DISBURSED_AT,
    });
  });

  it("C4: writes one audit row for the activation", async () => {
    await seedLoan(DRAFT_ID, "2026-0001", "DRAFT");
    await activate(DRAFT_ID, "1", goodBody);
    expect(await auditActions()).toHaveLength(1);
  });

  it("C5: accepts a first due date on the day after the disbursement", async () => {
    await seedLoan(DRAFT_ID, "2026-0001", "DRAFT");
    const res = await activate(DRAFT_ID, "1", { ...goodBody, disbursedAt: "2026-12-13" });
    expect(res.status).toBe(200);
    expect((await dbInstallments(DRAFT_ID))[0]?.due_date).toBe("2026-12-14");
  });
});

describe("POST /api/v1/loans/{id}/activate: recusas (A4 a A6)", () => {
  it("C6 (A4): unknown account answers 400 VALIDATION_FAILED on accountId, writing nothing", async () => {
    await seedLoan(DRAFT_ID, "2026-0001", "DRAFT");
    const res = await activate(DRAFT_ID, "1", { ...goodBody, accountId: UNKNOWN_ACCOUNT_ID });
    const body = res.body as LoanBody;
    expect(res.status).toBe(400);
    expect(body.code).toBe("VALIDATION_FAILED");
    expect(body.errors?.map((e) => e.field)).toEqual(["accountId"]);
    await expectNothingWritten(DRAFT_ID, "DRAFT", 1);
  });

  it("C7 (A4): inactive account answers 400 VALIDATION_FAILED on accountId, writing nothing", async () => {
    await seedLoan(DRAFT_ID, "2026-0001", "DRAFT");
    const res = await activate(DRAFT_ID, "1", { ...goodBody, accountId: INACTIVE_ACCOUNT_ID });
    expect(res.status).toBe(400);
    expect((res.body as LoanBody).errors?.map((e) => e.field)).toEqual(["accountId"]);
    await expectNothingWritten(DRAFT_ID, "DRAFT", 1);
  });

  it("C8 (A5): first due date equal to the disbursement answers 422 FIRST_DUE_DATE_BEFORE_DISBURSEMENT", async () => {
    await seedLoan(DRAFT_ID, "2026-0001", "DRAFT");
    const res = await activate(DRAFT_ID, "1", { ...goodBody, disbursedAt: "2026-12-14" });
    expect(res.status).toBe(422);
    expect((res.body as LoanBody).code).toBe("FIRST_DUE_DATE_BEFORE_DISBURSEMENT");
    await expectNothingWritten(DRAFT_ID, "DRAFT", 1);
  });

  it("C9 (A6): a loan that is not DRAFT answers 422 LOAN_NOT_EDITABLE, writing nothing", async () => {
    await seedLoan(DRAFT_ID, "2026-0001", "ACTIVE");
    const res = await activate(DRAFT_ID, "1", goodBody);
    expect(res.status).toBe(422);
    expect((res.body as LoanBody).code).toBe("LOAN_NOT_EDITABLE");
    await expectNothingWritten(DRAFT_ID, "ACTIVE", 1);
  });

  it("C10 (A6): wrong or missing If-Match answers 409 VERSION_CONFLICT, writing nothing", async () => {
    await seedLoan(DRAFT_ID, "2026-0001", "DRAFT");
    const wrong = await activate(DRAFT_ID, "7", goodBody);
    const missing = await activate(DRAFT_ID, undefined, goodBody);
    expect(wrong.status).toBe(409);
    expect((wrong.body as LoanBody).code).toBe("VERSION_CONFLICT");
    expect(missing.status).toBe(409);
    await expectNothingWritten(DRAFT_ID, "DRAFT", 1);
  });

  it("C10b: unknown loan answers 404", async () => {
    const res = await activate(UNKNOWN_LOAN_ID, "1", goodBody);
    expect(res.status).toBe(404);
  });
});

describe("POST /api/v1/loans/{id}/activate: origem (A7, A8)", () => {
  it("C11 (A7): activating a RENEWAL DRAFT turns the origin RENEWED and writes LoanRenewed", async () => {
    await seedLoan(ORIGIN_ID, "2026-0100", "ACTIVE");
    await seedLoan(DRAFT_ID, "2026-0101", "DRAFT", { loanId: ORIGIN_ID, type: "RENEWAL" });
    const res = await activate(DRAFT_ID, "1", goodBody);
    expect(res.status).toBe(200);
    expect(await dbLoan(ORIGIN_ID)).toMatchObject({ status: "RENEWED", version: 2 });
    const events = await outbox();
    expect(events.map((e) => e.event_type)).toEqual(["LoanActivated", "LoanRenewed"]);
    const renewed = events[1];
    expect(renewed?.aggregate_id).toBe(ORIGIN_ID);
    expect(renewed?.payload).toEqual({ loanId: ORIGIN_ID, successorLoanId: DRAFT_ID });
    const parsed = loanRenewedV1.safeParse({
      id: "01970000-0000-7000-8000-0000000000e2",
      type: renewed?.event_type,
      version: renewed?.event_version,
      occurredAt: renewed?.occurred_at.toISOString(),
      aggregateId: renewed?.aggregate_id,
      payload: renewed?.payload,
    });
    expect(parsed.success).toBe(true);
    expect(events[0]?.payload).toMatchObject({ originLoanId: ORIGIN_ID, originType: "RENEWAL" });
  });

  it("C12: activating a RENEGOTIATION DRAFT turns the origin RENEGOTIATED and writes LoanRenegotiated", async () => {
    await seedLoan(ORIGIN_ID, "2026-0100", "ACTIVE");
    await seedLoan(DRAFT_ID, "2026-0101", "DRAFT", { loanId: ORIGIN_ID, type: "RENEGOTIATION" }, 20000);
    const res = await activate(DRAFT_ID, "1", goodBody);
    expect(res.status).toBe(200);
    expect(await dbLoan(ORIGIN_ID)).toMatchObject({ status: "RENEGOTIATED", version: 2 });
    const events = await outbox();
    expect(events.map((e) => e.event_type)).toEqual(["LoanActivated", "LoanRenegotiated"]);
    const renegotiated = events[1];
    expect(renegotiated?.payload).toEqual({ loanId: ORIGIN_ID, successorLoanId: DRAFT_ID, capitalizedCents: 20000 });
    const parsed = loanRenegotiatedV1.safeParse({
      id: "01970000-0000-7000-8000-0000000000e3",
      type: renegotiated?.event_type,
      version: renegotiated?.event_version,
      occurredAt: renegotiated?.occurred_at.toISOString(),
      aggregateId: renegotiated?.aggregate_id,
      payload: renegotiated?.payload,
    });
    expect(parsed.success).toBe(true);
  });

  it("C13 (A8): an origin that is no longer ACTIVE answers 422 LOAN_NOT_EDITABLE, writing nothing", async () => {
    await seedLoan(ORIGIN_ID, "2026-0100", "PAID_OFF");
    await seedLoan(DRAFT_ID, "2026-0101", "DRAFT", { loanId: ORIGIN_ID, type: "RENEWAL" });
    const res = await activate(DRAFT_ID, "1", goodBody);
    expect(res.status).toBe(422);
    expect((res.body as LoanBody).code).toBe("LOAN_NOT_EDITABLE");
    expect(await dbLoan(DRAFT_ID)).toMatchObject({ status: "DRAFT", version: 1 });
    expect(await dbLoan(ORIGIN_ID)).toMatchObject({ status: "PAID_OFF", version: 1 });
    expect(await outbox()).toHaveLength(0);
    expect(await dbInstallments(DRAFT_ID)).toHaveLength(0);
  });
});

describe("POST /api/v1/loans/{id}/activate: tipos de contrato (cobertura dos ramos do cronograma)", () => {
  it("C14: a SINGLE_PAYMENT loan gets one installment with the whole principal", async () => {
    await seedLoan(DRAFT_ID, "2026-0001", "DRAFT", undefined, 0, { type: "SINGLE_PAYMENT", installmentCount: 1 });
    const res = await activate(DRAFT_ID, "1", goodBody);
    expect(res.status).toBe(200);
    const rows = await dbInstallments(DRAFT_ID);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.principal_cents).toBe(500000);
    expect(rows[0]?.due_date).toBe("2026-12-14");
  });

  it("C15: a type without automatic schedule answers 400 VALIDATION_FAILED on type, writing nothing", async () => {
    await seedLoan(DRAFT_ID, "2026-0001", "DRAFT", undefined, 0, { type: "INTEREST_ONLY", installmentCount: null });
    const res = await activate(DRAFT_ID, "1", goodBody);
    expect(res.status).toBe(400);
    expect((res.body as LoanBody).errors?.map((e) => e.field)).toEqual(["type"]);
    await expectNothingWritten(DRAFT_ID, "DRAFT", 1);
  });

  it("C16: an INSTALLMENT row without installment count (broken data) answers 500, writing nothing", async () => {
    await client.query("alter table lending.loans drop constraint loans_installment_count_check");
    await seedLoan(DRAFT_ID, "2026-0001", "DRAFT", undefined, 0, { type: "INSTALLMENT", installmentCount: null });
    const res = await activate(DRAFT_ID, "1", goodBody);
    expect(res.status).toBe(500);
    await expectNothingWritten(DRAFT_ID, "DRAFT", 1);
  });
});

describe("PATCH /api/v1/loans/{id}: troca para SINGLE_PAYMENT", () => {
  it("C17: switching an installment draft to SINGLE_PAYMENT without count 1 answers 400 on installmentCount", async () => {
    await seedLoan(DRAFT_ID, "2026-0001", "DRAFT");
    const res = await admin.patch(`/api/v1/loans/${DRAFT_ID}`).set("If-Match", "1").send({ type: "SINGLE_PAYMENT" });
    expect(res.status).toBe(400);
    expect((res.body as LoanBody).errors?.map((e) => e.field)).toEqual(["installmentCount"]);
    expect(await dbLoan(DRAFT_ID)).toMatchObject({ status: "DRAFT", version: 1 });
  });
});

describe("rascunho: ramos restantes de criar e editar", () => {
  const draftBody = {
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
  const insertTerms = () =>
    client.query(
      `insert into lending.default_terms
         (id, late_fee_bps, late_interest_monthly_bps, grace_period_days, suggested_monthly_rate_bps, rounding_step_cents, effective_from, created_by)
       values ('01970000-0000-7000-8000-0000000000d1', 200, 100, 0, 1000, 500, '2026-01-01T00:00:00Z', $1)`,
      [PERSON_ID],
    );

  it("C18: a loan with a DAY frequency is activated with the schedule in days", async () => {
    await seedLoan(DRAFT_ID, "2026-0001", "DRAFT", undefined, 0, {
      type: "INSTALLMENT",
      installmentCount: 6,
      unit: "DAY",
    });
    const res = await activate(DRAFT_ID, "1", goodBody);
    expect(res.status).toBe(200);
    expect((await dbInstallments(DRAFT_ID)).map((r) => r.due_date).slice(0, 2)).toEqual(["2026-12-14", "2026-12-15"]);
  });

  it("C19: creating without default terms answers 500, writing nothing", async () => {
    const res = await admin.post("/api/v1/loans").send(draftBody);
    expect(res.status).toBe(500);
    expect((await client.query("select 1 from lending.loans")).rows).toHaveLength(0);
  });

  it("C20: internal notes are kept on create and the frequency can be changed on edit", async () => {
    await insertTerms();
    const created = await admin.post("/api/v1/loans").send({ ...draftBody, internalNotes: "cliente antigo" });
    const loan = created.body as LoanBody & { internalNotes?: string };
    expect(created.status).toBe(201);
    expect(loan.internalNotes).toBe("cliente antigo");
    const edited = await admin
      .patch(`/api/v1/loans/${loan.id}`)
      .set("If-Match", "1")
      .send({ frequency: { unit: "DAY", interval: 30 } });
    expect(edited.status).toBe(200);
    expect((edited.body as { frequency: unknown }).frequency).toEqual({ unit: "DAY", interval: 30 });
  });
});
