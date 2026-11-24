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

const env: ApiEnv = {
  host: "127.0.0.1",
  port: 3000,
  databaseUrl: "postgres://u:p@127.0.0.1:1/pilla",
  accessHashKey: "chave-de-teste-do-hash-com-mais-de-32-caracteres",
};
const uuid = (n: number): string => `01970000-0000-7000-8000-${String(1000000000000 + n).slice(1)}`;
const PERSON = uuid(1);
const ACCOUNT = uuid(3);
const USER = uuid(4);
const LOAN = uuid(11);
let counter = 100;
const nextId = (): string => uuid(++counter);

type LoanBody = {
  id?: string;
  loanNumber?: string;
  personId?: string;
  type?: string;
  status?: string;
  principalCents?: number;
  monthlyInterestRateBps?: number;
  installmentCount?: number | null;
  frequency?: { unit: string; interval: number };
  firstDueDate?: string;
  contractedAt?: string;
  accountId?: string | null;
  disbursedAt?: string | null;
  lateFeeBps?: number;
  lateInterestMonthlyBps?: number;
  gracePeriodDays?: number;
  roundingStepCents?: number;
  originLoanId?: string;
  originType?: string;
  capitalizedAmountCents?: number;
  version?: number;
  code?: string;
  errors?: { field: string }[];
};
type DbLoan = {
  status: string;
  version: number;
  origin_loan_id: string | null;
  origin_type: string | null;
  capitalized: number;
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
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-20T15:00:00Z"));
  for (const table of [
    "core.audit_log",
    "core.outbox",
    "treasury.ledger_entries",
    "payments.payment_allocations",
    "payments.payments",
    "lending.installments",
    "lending.loans",
    "lending.loan_number_sequences",
    "treasury.accounts",
    "people.persons",
  ]) {
    await client.query(`delete from ${table}`);
  }
  await client.query(
    `insert into people.persons (id, full_name, cpf, phone) values ($1, 'Ana Souza', '52998224725', '+5511987654321')`,
    [PERSON],
  );
  await client.query(`insert into treasury.accounts (id, name, active) values ($1, 'Conta ativa', true)`, [ACCOUNT]);
});
afterEach(() => {
  vi.useRealTimers();
});

async function seedLoan(
  status: string,
  shape: { type: string; installmentCount: number | null } = { type: "INSTALLMENT", installmentCount: 5 },
): Promise<void> {
  await client.query("insert into lending.loan_number_sequences (year, last_value) values (2026, 1)");
  await client.query(
    `insert into lending.loans
       (id, loan_number, person_id, type, status, principal_cents, monthly_interest_rate_bps, installment_count,
        frequency_unit, frequency_interval, first_due_date, contracted_at, disbursed_at, account_id,
        late_fee_bps, late_interest_monthly_bps, grace_period_days, rounding_step_cents)
     values ($1, '2026-0001', $2, $5, $3, 500000, 633, $6, 'MONTH', 1, '2026-09-20', '2026-08-15',
        '2026-08-20', $4, 250, 120, 0, 500)`,
    [LOAN, PERSON, status, ACCOUNT, shape.type, shape.installmentCount],
  );
}

// Cinco parcelas de 1.200,00 (principal 1.000,00 e juros 200,00), vencendo antes, no dia e depois de 2026-11-20.
// `paid` diz quanto cada parcela recebeu em principal e juros (parcelas sem entrada não receberam nada).
async function seedSchedule(paid: Record<number, [principal: number, interest: number]>): Promise<void> {
  const dueDates = ["2026-09-20", "2026-10-20", "2026-11-19", "2026-11-20", "2026-12-20"];
  const ids: string[] = [];
  for (const [index, dueDate] of dueDates.entries()) {
    const id = nextId();
    ids.push(id);
    await client.query(
      `insert into lending.installments (id, loan_id, number, due_date, principal_cents, interest_cents, total_cents)
       values ($1, $2, $3, $4, 100000, 20000, 120000)`,
      [id, LOAN, index + 1, dueDate],
    );
  }
  const paymentId = nextId();
  await client.query(
    `insert into payments.payments (id, loan_id, person_id, account_id, paid_at, amount_cents, method, channel, status, created_by)
     values ($1, $2, $3, $4, '2026-11-01', 1, 'CASH', 'ADMIN', 'CONFIRMED', $5)`,
    [paymentId, LOAN, PERSON, ACCOUNT, USER],
  );
  for (const [number, [principal, interest]] of Object.entries(paid)) {
    await client.query(
      `insert into payments.payment_allocations
         (id, payment_id, loan_id, installment_id, late_charges_cents, interest_cents, principal_cents)
       values ($1, $2, $3, $4, 0, $5, $6)`,
      [nextId(), paymentId, LOAN, ids[Number(number) - 1], interest, principal],
    );
  }
}

async function dbLoan(id: string): Promise<DbLoan | undefined> {
  const result = await client.query<DbLoan>(
    `select status, version, origin_loan_id, origin_type, capitalized_amount_cents as capitalized
     from lending.loans where id = $1`,
    [id],
  );
  return result.rows[0];
}

async function count(table: string): Promise<number> {
  const result = await client.query<{ total: string }>(`select count(*) as total from ${table}`);
  return Number(result.rows[0]?.total);
}

async function trail(): Promise<{ outbox: number; ledger: number; payments: number; installments: number }> {
  return {
    outbox: await count("core.outbox"),
    ledger: await count("treasury.ledger_entries"),
    payments: await count("payments.payments"),
    installments: await count("lending.installments"),
  };
}

const UNTOUCHED = { outbox: 0, ledger: 0, payments: 1, installments: 5 };

const FRESH = "2027-01-15";

async function renegotiate(
  id: string,
  payload: object,
): Promise<{ status: number; body: LoanBody; location: unknown }> {
  const res = await admin.post(`/api/v1/loans/${id}/renegotiate`).send(payload);
  return { status: res.status, body: res.body as LoanBody, location: res.headers["location"] };
}

// Parcelas 1 e 2 pagas (a 2 só em parte). Em 2026-11-20: principal em aberto 3.600,00, juros em aberto 600,00 e
// encargos 50,00, então o saldo devedor é 4.250,00.
const PARTIAL: Record<number, [number, number]> = { 1: [100000, 20000], 2: [40000, 20000] };

describe("POST /api/v1/loans/{id}/renegotiate: feliz (E10-F06, A5 a A7)", () => {
  it("C8 (A5): an ACTIVE origin answers 201 with a new DRAFT of RENEGOTIATION", async () => {
    await seedLoan("ACTIVE");
    await seedSchedule(PARTIAL);
    const { status, body, location } = await renegotiate(LOAN, { firstDueDate: FRESH });
    expect(status).toBe(201);
    expect(body.status).toBe("DRAFT");
    expect(body.originType).toBe("RENEGOTIATION");
    expect(body.originLoanId).toBe(LOAN);
    expect(body.id).not.toBe(LOAN);
    expect(location).toBe(`/api/v1/loans/${String(body.id)}`);
  });

  it("C9 (A6): the new principal is the outstanding balance at the date", async () => {
    await seedLoan("ACTIVE");
    await seedSchedule(PARTIAL);
    const { body } = await renegotiate(LOAN, { firstDueDate: FRESH });
    expect(body.principalCents).toBe(425000);
  });

  it("C10 (A7): capitalized_amount_cents is the balance minus the open principal, in the response and in the database", async () => {
    await seedLoan("ACTIVE");
    await seedSchedule(PARTIAL);
    const { body } = await renegotiate(LOAN, { firstDueDate: FRESH });
    expect(body.capitalizedAmountCents).toBe(65000);
    expect(await dbLoan(String(body.id))).toEqual({
      status: "DRAFT",
      version: 1,
      origin_loan_id: LOAN,
      origin_type: "RENEGOTIATION",
      capitalized: 65000,
    });
  });

  it("C10 (A7): with nothing overdue or paid in part the balance is still principal plus open interest", async () => {
    await seedLoan("ACTIVE");
    await seedSchedule({ 1: [100000, 20000], 2: [100000, 20000], 3: [100000, 20000] });
    const { body } = await renegotiate(LOAN, { firstDueDate: FRESH });
    expect(body.principalCents).toBe(240000);
    expect(body.capitalizedAmountCents).toBe(40000);
  });

  it("C11 (A5): the new DRAFT copies the origin terms; adjustments replace them", async () => {
    await seedLoan("ACTIVE");
    await seedSchedule(PARTIAL);
    const plain = await renegotiate(LOAN, { firstDueDate: FRESH });
    expect(plain.body).toMatchObject({
      personId: PERSON,
      type: "INSTALLMENT",
      monthlyInterestRateBps: 633,
      installmentCount: 5,
      frequency: { unit: "MONTH", interval: 1 },
      firstDueDate: FRESH,
      contractedAt: "2026-11-20",
      lateFeeBps: 250,
      lateInterestMonthlyBps: 120,
      gracePeriodDays: 0,
      roundingStepCents: 500,
    });
    const adjusted = await renegotiate(LOAN, {
      firstDueDate: FRESH,
      monthlyInterestRateBps: 400,
      installmentCount: 8,
      frequency: { unit: "DAY", interval: 30 },
    });
    expect(adjusted.body).toMatchObject({
      monthlyInterestRateBps: 400,
      installmentCount: 8,
      frequency: { unit: "DAY", interval: 30 },
    });
  });

  it("C12 (A5): the origin stays ACTIVE with the same version, with no outbox, ledger or payment row", async () => {
    await seedLoan("ACTIVE");
    await seedSchedule(PARTIAL);
    await renegotiate(LOAN, { firstDueDate: FRESH });
    expect(await dbLoan(LOAN)).toMatchObject({ status: "ACTIVE", version: 1, origin_loan_id: null });
    expect(await trail()).toEqual(UNTOUCHED);
  });

  it("C12: unlike the renewal, an origin with overdue interest in open can be renegotiated", async () => {
    await seedLoan("ACTIVE");
    await seedSchedule({});
    const { status, body } = await renegotiate(LOAN, { firstDueDate: FRESH });
    expect(status).toBe(201);
    expect(body.capitalizedAmountCents).toBeGreaterThan(0);
  });

  it("C12: an origin without an installment type (import) renegotiates as INSTALLMENT when the count is given", async () => {
    await seedLoan("ACTIVE", { type: "INTEREST_ONLY", installmentCount: null });
    await seedSchedule(PARTIAL);
    const { status, body } = await renegotiate(LOAN, { firstDueDate: FRESH, installmentCount: 6 });
    expect(status).toBe(201);
    expect(body).toMatchObject({ type: "INSTALLMENT", installmentCount: 6 });
  });
});

describe("POST /api/v1/loans/{id}/renegotiate: origem e corpo (E10-F06, A8, A9)", () => {
  it.each(["DRAFT", "PAID_OFF", "RENEWED", "RENEGOTIATED", "WRITTEN_OFF", "CANCELLED"])(
    "C13 (A8): an origin in %s answers 422 LOAN_NOT_EDITABLE and writes nothing",
    async (status) => {
      await seedLoan(status);
      await seedSchedule(PARTIAL);
      const res = await renegotiate(LOAN, { firstDueDate: FRESH });
      expect(res.status).toBe(422);
      expect(res.body.code).toBe("LOAN_NOT_EDITABLE");
      expect(await count("lending.loans")).toBe(1);
      expect(await trail()).toEqual(UNTOUCHED);
    },
  );

  it("C14: answers 404 for an unknown loan and 400 for an invalid id", async () => {
    expect((await renegotiate(uuid(97), { firstDueDate: FRESH })).status).toBe(404);
    expect((await renegotiate("x", { firstDueDate: FRESH })).status).toBe(400);
  });

  it("C14: a missing firstDueDate or an unknown field answers 400 and creates nothing", async () => {
    await seedLoan("ACTIVE");
    await seedSchedule(PARTIAL);
    const missing = await renegotiate(LOAN, {});
    expect(missing.status).toBe(400);
    expect(missing.body.errors?.map((e) => e.field)).toEqual(["firstDueDate"]);
    expect((await renegotiate(LOAN, { firstDueDate: FRESH, capitalizedAmountCents: 1 })).status).toBe(400);
    expect(await count("lending.loans")).toBe(1);
  });

  it("C14: an import origin without a count, or a SINGLE_PAYMENT origin with a count other than 1, answers 400", async () => {
    await seedLoan("ACTIVE", { type: "SINGLE_PAYMENT", installmentCount: 1 });
    await seedSchedule(PARTIAL);
    const single = await renegotiate(LOAN, { firstDueDate: FRESH, installmentCount: 2 });
    expect(single.status).toBe(400);
    expect(single.body.errors?.map((e) => e.field)).toEqual(["installmentCount"]);
    await client.query("update lending.loans set type = 'INTEREST_ONLY', installment_count = null");
    expect((await renegotiate(LOAN, { firstDueDate: FRESH })).status).toBe(400);
    expect(await count("lending.loans")).toBe(1);
  });
});
