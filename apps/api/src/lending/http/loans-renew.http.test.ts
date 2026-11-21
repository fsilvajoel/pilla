import type { PGlite } from "@electric-sql/pglite";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AppModule } from "../../app.module";
import { configureApp } from "../../core/http/configure-app";
import type { ApiEnv } from "../../core/http/env";
import { DATABASE_HANDLE } from "../../db/database";
import { migratedTestDb } from "../../db/test-db";

const env: ApiEnv = { host: "127.0.0.1", port: 3000, databaseUrl: "postgres://u:p@127.0.0.1:1/pilla" };
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

async function renew(id: string, payload: object): Promise<{ status: number; body: LoanBody; location: unknown }> {
  const res = await request(baseUrl).post(`/api/v1/loans/${id}/renew`).send(payload);
  return { status: res.status, body: res.body as LoanBody, location: res.headers["location"] };
}

// Pagas as parcelas 1 a 3 (vencidas); a 4 vence hoje e a 5 é futura: principal em aberto = 2.000,00.
const ALL_OVERDUE_PAID: Record<number, [number, number]> = {
  1: [100000, 20000],
  2: [100000, 20000],
  3: [100000, 20000],
};

describe("POST /api/v1/loans/{id}/renew: feliz (E10-F06, A1 a A4)", () => {
  it("C1 (A1): ACTIVE with overdue interest and charges paid answers 201 with a new DRAFT of RENEWAL", async () => {
    await seedLoan("ACTIVE");
    await seedSchedule(ALL_OVERDUE_PAID);
    const { status, body, location } = await renew(LOAN, { firstDueDate: FRESH });
    expect(status).toBe(201);
    expect(body.status).toBe("DRAFT");
    expect(body.originType).toBe("RENEWAL");
    expect(body.originLoanId).toBe(LOAN);
    expect(body.id).not.toBe(LOAN);
    expect(location).toBe(`/api/v1/loans/${String(body.id)}`);
    expect(await dbLoan(String(body.id))).toEqual({
      status: "DRAFT",
      version: 1,
      origin_loan_id: LOAN,
      origin_type: "RENEWAL",
      capitalized: 0,
    });
  });

  it("C2 (A2): the new principal is the open principal of the origin", async () => {
    await seedLoan("ACTIVE");
    await seedSchedule({ ...ALL_OVERDUE_PAID, 4: [30000, 20000] });
    const { body } = await renew(LOAN, { firstDueDate: FRESH });
    expect(body.principalCents).toBe(170000);
    expect(body.capitalizedAmountCents).toBe(0);
  });

  it("C3 (A1): without adjustments the new DRAFT copies the origin terms and takes the fresh first due date", async () => {
    await seedLoan("ACTIVE");
    await seedSchedule(ALL_OVERDUE_PAID);
    const { body } = await renew(LOAN, { firstDueDate: FRESH });
    expect(body).toMatchObject({
      loanNumber: "2026-0002",
      personId: PERSON,
      type: "INSTALLMENT",
      monthlyInterestRateBps: 633,
      installmentCount: 5,
      frequency: { unit: "MONTH", interval: 1 },
      firstDueDate: FRESH,
      contractedAt: "2026-11-20",
      accountId: null,
      disbursedAt: null,
      lateFeeBps: 250,
      lateInterestMonthlyBps: 120,
      gracePeriodDays: 0,
      roundingStepCents: 500,
      version: 1,
    });
  });

  it("C4 (A1): rate, count and frequency adjustments replace the copied terms", async () => {
    await seedLoan("ACTIVE");
    await seedSchedule(ALL_OVERDUE_PAID);
    const { body } = await renew(LOAN, {
      firstDueDate: FRESH,
      monthlyInterestRateBps: 500,
      installmentCount: 3,
      frequency: { unit: "DAY", interval: 15 },
    });
    expect(body).toMatchObject({
      monthlyInterestRateBps: 500,
      installmentCount: 3,
      frequency: { unit: "DAY", interval: 15 },
      firstDueDate: FRESH,
    });
  });

  it("C5 (A4): the origin stays ACTIVE with the same version after the renewal", async () => {
    await seedLoan("ACTIVE");
    await seedSchedule(ALL_OVERDUE_PAID);
    await renew(LOAN, { firstDueDate: FRESH });
    expect(await dbLoan(LOAN)).toMatchObject({ status: "ACTIVE", version: 1, origin_loan_id: null, origin_type: null });
  });

  it("C6 (A8): creating the DRAFT writes no outbox, ledger or payment row", async () => {
    await seedLoan("ACTIVE");
    await seedSchedule(ALL_OVERDUE_PAID);
    await renew(LOAN, { firstDueDate: FRESH });
    expect(await trail()).toEqual(UNTOUCHED);
  });

  it("C7: a SINGLE_PAYMENT origin renews as SINGLE_PAYMENT with one installment", async () => {
    await seedLoan("ACTIVE", { type: "SINGLE_PAYMENT", installmentCount: 1 });
    await seedSchedule(ALL_OVERDUE_PAID);
    const { status, body } = await renew(LOAN, { firstDueDate: FRESH });
    expect(status).toBe(201);
    expect(body).toMatchObject({ type: "SINGLE_PAYMENT", installmentCount: 1 });
  });

  it("C7: an origin without an installment type (import) renews as INSTALLMENT when the count is given", async () => {
    await seedLoan("ACTIVE", { type: "INTEREST_ONLY", installmentCount: null });
    await seedSchedule(ALL_OVERDUE_PAID);
    const { status, body } = await renew(LOAN, { firstDueDate: FRESH, installmentCount: 4 });
    expect(status).toBe(201);
    expect(body).toMatchObject({ type: "INSTALLMENT", installmentCount: 4 });
  });
});

describe("POST /api/v1/loans/{id}/renew: bloqueios (E10-F06, A3, A8)", () => {
  it("C8 (A3): interest of an overdue installment paid only in part answers 422 RENEWAL_REQUIRES_INTEREST_PAID", async () => {
    await seedLoan("ACTIVE");
    await seedSchedule({ ...ALL_OVERDUE_PAID, 2: [100000, 5000] });
    const { status, body } = await renew(LOAN, { firstDueDate: FRESH });
    expect(status).toBe(422);
    expect(body.code).toBe("RENEWAL_REQUIRES_INTEREST_PAID");
  });

  it("C9 (A3): open late charges alone also block, even with the interest paid", async () => {
    await seedLoan("ACTIVE");
    await seedSchedule({ ...ALL_OVERDUE_PAID, 3: [0, 20000] });
    const { status, body } = await renew(LOAN, { firstDueDate: FRESH });
    expect(status).toBe(422);
    expect(body.code).toBe("RENEWAL_REQUIRES_INTEREST_PAID");
  });

  it("C10 (A3): an overdue installment with nothing paid blocks", async () => {
    await seedLoan("ACTIVE");
    await seedSchedule({ 1: [100000, 20000] });
    expect((await renew(LOAN, { firstDueDate: FRESH })).body.code).toBe("RENEWAL_REQUIRES_INTEREST_PAID");
  });

  it("C11 (A4): a blocked renewal creates nothing and leaves the origin ACTIVE", async () => {
    await seedLoan("ACTIVE");
    await seedSchedule({ 1: [100000, 20000] });
    await renew(LOAN, { firstDueDate: FRESH });
    expect(await count("lending.loans")).toBe(1);
    expect(await dbLoan(LOAN)).toMatchObject({ status: "ACTIVE", version: 1 });
    expect(await trail()).toEqual(UNTOUCHED);
  });
});

describe("POST /api/v1/loans/{id}/renew: origem e corpo (E10-F06, A8, A9)", () => {
  it.each(["DRAFT", "PAID_OFF", "RENEWED", "RENEGOTIATED", "WRITTEN_OFF", "CANCELLED"])(
    "C13 (A8): an origin in %s answers 422 LOAN_NOT_EDITABLE and writes nothing",
    async (status) => {
      await seedLoan(status);
      await seedSchedule(ALL_OVERDUE_PAID);
      const res = await renew(LOAN, { firstDueDate: FRESH });
      expect(res.status).toBe(422);
      expect(res.body.code).toBe("LOAN_NOT_EDITABLE");
      expect(await count("lending.loans")).toBe(1);
      expect(await trail()).toEqual(UNTOUCHED);
    },
  );

  it("C14: answers 404 for an unknown loan and 400 for an invalid id", async () => {
    expect((await renew(uuid(97), { firstDueDate: FRESH })).status).toBe(404);
    expect((await renew("x", { firstDueDate: FRESH })).status).toBe(400);
  });

  it("C14: a missing or invalid firstDueDate, or an unknown field, answers 400", async () => {
    await seedLoan("ACTIVE");
    await seedSchedule(ALL_OVERDUE_PAID);
    const missing = await renew(LOAN, {});
    expect(missing.status).toBe(400);
    expect(missing.body.errors?.map((e) => e.field)).toEqual(["firstDueDate"]);
    expect((await renew(LOAN, { firstDueDate: "2027-02-30" })).status).toBe(400);
    expect((await renew(LOAN, { firstDueDate: FRESH, principalCents: 1000 })).status).toBe(400);
    expect(await count("lending.loans")).toBe(1);
  });

  it("C14: a SINGLE_PAYMENT origin with a count other than 1, or an import origin without a count, answers 400", async () => {
    await seedLoan("ACTIVE", { type: "SINGLE_PAYMENT", installmentCount: 1 });
    await seedSchedule(ALL_OVERDUE_PAID);
    const single = await renew(LOAN, { firstDueDate: FRESH, installmentCount: 3 });
    expect(single.status).toBe(400);
    expect(single.body.errors?.map((e) => e.field)).toEqual(["installmentCount"]);
    await client.query("update lending.loans set type = 'INTEREST_ONLY', installment_count = null");
    const imported = await renew(LOAN, { firstDueDate: FRESH });
    expect(imported.status).toBe(400);
    expect(imported.body.errors?.map((e) => e.field)).toEqual(["installmentCount"]);
    expect(await count("lending.loans")).toBe(1);
  });
});
