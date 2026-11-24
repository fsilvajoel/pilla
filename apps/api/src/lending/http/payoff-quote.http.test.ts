import type { PGlite } from "@electric-sql/pglite";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { payoffQuoteResponse } from "@pilla/schemas";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { type AdminAgent, loginAsAdmin } from "../../core/http/test-admin-agent";
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
});
afterAll(async () => {
  await app.close();
  await client.close();
});
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-20T15:00:00Z"));
  await client.query("delete from payments.payment_allocations");
  await client.query("delete from payments.payments");
  await client.query("delete from lending.installments");
  await client.query("delete from lending.loans");
});
afterEach(() => {
  vi.useRealTimers();
});

async function seedLoan(status: string): Promise<void> {
  await client.query(
    `insert into lending.loans
       (id, loan_number, person_id, type, status, principal_cents, monthly_interest_rate_bps, installment_count,
        frequency_unit, frequency_interval, first_due_date, contracted_at, disbursed_at, account_id,
        late_fee_bps, late_interest_monthly_bps, grace_period_days, rounding_step_cents)
     values ($1, '2026-0001', $2, 'INSTALLMENT', $3, 500000, 633, 5, 'MONTH', 1, '2026-09-20', '2026-08-15',
        '2026-08-20', $4, 250, 120, 0, 500)`,
    [LOAN, PERSON, status, ACCOUNT],
  );
}

// Cinco parcelas de 1.200,00 (principal 1.000,00 e juros 200,00); a 1 e a 2 recebem pagamento.
async function seedSchedule(): Promise<void> {
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
     values ($1, $2, $3, $4, '2026-11-01', 180000, 'CASH', 'ADMIN', 'CONFIRMED', $5)`,
    [paymentId, LOAN, PERSON, ACCOUNT, USER],
  );
  const paid: [string | undefined, number, number][] = [
    [ids[0], 100000, 20000],
    [ids[1], 40000, 20000],
  ];
  for (const [installmentId, principal, interest] of paid) {
    await client.query(
      `insert into payments.payment_allocations
         (id, payment_id, loan_id, installment_id, late_charges_cents, interest_cents, principal_cents)
       values ($1, $2, $3, $4, 0, $5, $6)`,
      [nextId(), paymentId, LOAN, installmentId, interest, principal],
    );
  }
}

type QuoteBody = {
  date?: string;
  amountCents?: number;
  principalCents?: number;
  interestCents?: number;
  lateChargesCents?: number;
  code?: string;
  errors?: { field: string }[];
};

async function quote(id: string, query: string): Promise<{ status: number; body: QuoteBody }> {
  const res = await admin.get(`/api/v1/loans/${id}/payoff-quote${query}`);
  return { status: res.status, body: res.body as QuoteBody };
}

describe("GET /api/v1/loans/{id}/payoff-quote (E10-F05, A7 to A9)", () => {
  it("C13 (A7): open principal plus open interest plus charges at the date, no discount", async () => {
    await seedLoan("ACTIVE");
    await seedSchedule();
    const { status, body } = await quote(LOAN, "?date=2026-11-20");
    expect(status).toBe(200);
    expect(payoffQuoteResponse.safeParse(body).success).toBe(true);
    expect(body).toEqual({
      date: "2026-11-20",
      amountCents: 425000,
      principalCents: 360000,
      interestCents: 60000,
      lateChargesCents: 5000,
    });
  });

  it("C14 (A7): the amount is the sum of the components at any date", async () => {
    await seedLoan("ACTIVE");
    await seedSchedule();
    const { body } = await quote(LOAN, "?date=2026-12-20");
    expect(body).toEqual({
      date: "2026-12-20",
      amountCents: 432000,
      principalCents: 360000,
      interestCents: 60000,
      lateChargesCents: 12000,
    });
    expect((body.principalCents ?? 0) + (body.interestCents ?? 0) + (body.lateChargesCents ?? 0)).toBe(
      body.amountCents,
    );
  });

  it("C15 (A8): a date before the disbursement answers 400 on date; the disbursement day is accepted", async () => {
    await seedLoan("ACTIVE");
    await seedSchedule();
    const before = await quote(LOAN, "?date=2026-08-19");
    expect(before.status).toBe(400);
    expect(before.body.errors?.map((e) => e.field)).toEqual(["date"]);
    expect((await quote(LOAN, "?date=2026-08-20")).status).toBe(200);
  });

  it("C16 (A9): a loan that is not ACTIVE answers 422 LOAN_NOT_EDITABLE", async () => {
    await seedLoan("PAID_OFF");
    const { status, body } = await quote(LOAN, "?date=2026-11-20");
    expect(status).toBe(422);
    expect(body.code).toBe("LOAN_NOT_EDITABLE");
  });

  it("C16: answers 404 for an unknown loan and 400 for a missing or invalid date or id", async () => {
    await seedLoan("ACTIVE");
    expect((await quote(uuid(97), "?date=2026-11-20")).status).toBe(404);
    expect((await quote(LOAN, "")).status).toBe(400);
    expect((await quote(LOAN, "?date=20/11/2026")).status).toBe(400);
    expect((await quote("x", "?date=2026-11-20")).status).toBe(400);
  });
});
