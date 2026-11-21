import type { PGlite } from "@electric-sql/pglite";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { dashboardTodayResponse, type DashboardTodayResponse } from "@pilla/schemas";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AppModule } from "../../app.module";
import { configureApp } from "../../core/http/configure-app";
import type { ApiEnv } from "../../core/http/env";
import { DATABASE_HANDLE } from "../../db/database";
import { migratedTestDb } from "../../db/test-db";

const env: ApiEnv = { host: "127.0.0.1", port: 3000, databaseUrl: "postgres://u:p@127.0.0.1:1/pilla" };
const uuid = (n: number): string => `01970000-0000-7000-8000-${String(1000000000000 + n).slice(1)}`;
const ANA = uuid(1);
const CARLOS = uuid(2);
const ACCOUNT = uuid(3);
const USER = uuid(4);
const A = uuid(11);
const B = uuid(12);
const DRAFT = uuid(13);

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
  await client.query("delete from payments.payment_allocations");
  await client.query("delete from payments.payments");
  await client.query("delete from lending.installments");
  await client.query("delete from lending.loans");
  await client.query("delete from people.persons");
  await client.query("delete from treasury.accounts");
  await client.query(
    `insert into people.persons (id, full_name, cpf, phone) values
     ($1, 'Ana Souza', '52998224725', '+5511987654321'),
     ($2, 'Carlos Moraes', '11144477735', '+5511987654302')`,
    [ANA, CARLOS],
  );
});
afterEach(() => {
  vi.useRealTimers();
});

async function seedLoan(id: string, number: string, personId: string, status: string): Promise<void> {
  const draft = status === "DRAFT";
  await client.query(
    `insert into lending.loans
       (id, loan_number, person_id, type, status, principal_cents, monthly_interest_rate_bps, installment_count,
        frequency_unit, frequency_interval, first_due_date, contracted_at, disbursed_at, account_id,
        late_fee_bps, late_interest_monthly_bps, grace_period_days, rounding_step_cents)
     values ($1, $2, $3, 'INSTALLMENT', $4, 500000, 633, 5, 'MONTH', 1, '2026-12-20', '2026-11-15', $5, $6,
        250, 120, 0, 500)`,
    [id, number, personId, status, draft ? null : "2026-11-16", draft ? null : ACCOUNT],
  );
}

type SeedPayment = {
  id: string;
  loanId: string;
  personId: string;
  status: string;
  amountCents: number;
  createdAt: string;
  method?: string;
  paidAt?: string;
};

async function seedPayment(p: SeedPayment): Promise<void> {
  await client.query(
    `insert into payments.payments
       (id, loan_id, person_id, account_id, paid_at, amount_cents, method, channel, status, created_at, created_by)
     values ($1, $2, $3, $4, $5, $6, $7, 'ADMIN', $8, $9, $10)`,
    [
      p.id,
      p.loanId,
      p.personId,
      ACCOUNT,
      p.paidAt ?? "2026-11-19",
      p.amountCents,
      p.method ?? "PIX",
      p.status,
      p.createdAt,
      USER,
    ],
  );
}

async function today(): Promise<{ status: number; body: DashboardTodayResponse }> {
  const res = await request(baseUrl).get("/api/v1/dashboard/today");
  return { status: res.status, body: res.body as DashboardTodayResponse };
}

describe("GET /api/v1/dashboard/today pendingReview block (E13-F02B, A1 to A7)", () => {
  it("C5 (A3): totals count and sum every PENDING_REVIEW payment", async () => {
    await seedLoan(A, "2026-0001", ANA, "ACTIVE");
    await seedPayment({
      id: uuid(201),
      loanId: A,
      personId: ANA,
      status: "PENDING_REVIEW",
      amountCents: 150000,
      createdAt: "2026-11-19T10:00:00Z",
    });
    await seedPayment({
      id: uuid(202),
      loanId: A,
      personId: ANA,
      status: "PENDING_REVIEW",
      amountCents: 2500,
      createdAt: "2026-11-19T11:00:00Z",
    });
    const { status, body } = await today();
    expect(status).toBe(200);
    expect(dashboardTodayResponse.safeParse(body).success).toBe(true);
    expect(body.pendingReview.count).toBe(2);
    expect(body.pendingReview.totalCents).toBe(152500);
    expect(body.pendingReview.items).toHaveLength(2);
  });

  it("C6 (A4): each item carries payment, contract and person fields", async () => {
    await seedLoan(A, "2026-0001", ANA, "ACTIVE");
    await seedPayment({
      id: uuid(201),
      loanId: A,
      personId: ANA,
      status: "PENDING_REVIEW",
      amountCents: 150000,
      createdAt: "2026-11-19T10:00:00Z",
      method: "CASH",
      paidAt: "2026-11-18",
    });
    const { body } = await today();
    expect(body.pendingReview.items).toEqual([
      {
        paymentId: uuid(201),
        loanId: A,
        loanNumber: "2026-0001",
        personName: "Ana Souza",
        loanStatus: "ACTIVE",
        amountCents: 150000,
        paidAt: "2026-11-18",
        method: "CASH",
        createdAt: "2026-11-19T10:00:00.000Z",
      },
    ]);
  });

  it("C7 (A2 of the port, plano rule): oldest createdAt first, ties by id", async () => {
    await seedLoan(A, "2026-0001", ANA, "ACTIVE");
    await seedPayment({
      id: uuid(203),
      loanId: A,
      personId: ANA,
      status: "PENDING_REVIEW",
      amountCents: 100,
      createdAt: "2026-11-19T12:00:00Z",
    });
    await seedPayment({
      id: uuid(202),
      loanId: A,
      personId: ANA,
      status: "PENDING_REVIEW",
      amountCents: 100,
      createdAt: "2026-11-19T10:00:00Z",
    });
    await seedPayment({
      id: uuid(201),
      loanId: A,
      personId: ANA,
      status: "PENDING_REVIEW",
      amountCents: 100,
      createdAt: "2026-11-19T10:00:00Z",
    });
    const { body } = await today();
    expect(body.pendingReview.items.map((item) => item.paymentId)).toEqual([uuid(201), uuid(202), uuid(203)]);
  });

  it("C8 (A5): a payment on a DRAFT loan is included with loanStatus DRAFT", async () => {
    await seedLoan(DRAFT, "2026-0003", CARLOS, "DRAFT");
    await seedPayment({
      id: uuid(201),
      loanId: DRAFT,
      personId: CARLOS,
      status: "PENDING_REVIEW",
      amountCents: 5000,
      createdAt: "2026-11-19T10:00:00Z",
    });
    const { body } = await today();
    expect(body.pendingReview.count).toBe(1);
    expect(body.pendingReview.items[0]).toMatchObject({
      loanId: DRAFT,
      loanNumber: "2026-0003",
      personName: "Carlos Moraes",
      loanStatus: "DRAFT",
    });
  });

  it("C9 (A7): CONFIRMED and REVERSED payments never appear", async () => {
    await seedLoan(A, "2026-0001", ANA, "ACTIVE");
    await seedPayment({
      id: uuid(201),
      loanId: A,
      personId: ANA,
      status: "CONFIRMED",
      amountCents: 1000,
      createdAt: "2026-11-19T10:00:00Z",
    });
    await seedPayment({
      id: uuid(202),
      loanId: A,
      personId: ANA,
      status: "REVERSED",
      amountCents: 2000,
      createdAt: "2026-11-19T11:00:00Z",
    });
    await seedPayment({
      id: uuid(203),
      loanId: A,
      personId: ANA,
      status: "PENDING_REVIEW",
      amountCents: 3000,
      createdAt: "2026-11-19T12:00:00Z",
    });
    const { body } = await today();
    expect(body.pendingReview.count).toBe(1);
    expect(body.pendingReview.totalCents).toBe(3000);
    expect(body.pendingReview.items.map((item) => item.paymentId)).toEqual([uuid(203)]);
  });

  it("C10 (A6): once the payment leaves PENDING_REVIEW (confirmed) it leaves the block", async () => {
    await seedLoan(A, "2026-0001", ANA, "ACTIVE");
    await seedPayment({
      id: uuid(201),
      loanId: A,
      personId: ANA,
      status: "PENDING_REVIEW",
      amountCents: 1000,
      createdAt: "2026-11-19T10:00:00Z",
    });
    expect((await today()).body.pendingReview.count).toBe(1);
    await client.query("update payments.payments set status = 'CONFIRMED' where id = $1", [uuid(201)]);
    const { body } = await today();
    expect(body.pendingReview).toEqual({ count: 0, totalCents: 0, items: [] });
  });

  it("C11: payments of several people and contracts resolve their own person and loan number", async () => {
    await seedLoan(A, "2026-0001", ANA, "ACTIVE");
    await seedLoan(B, "2026-0002", CARLOS, "ACTIVE");
    await seedPayment({
      id: uuid(201),
      loanId: B,
      personId: CARLOS,
      status: "PENDING_REVIEW",
      amountCents: 700,
      createdAt: "2026-11-19T10:00:00Z",
    });
    await seedPayment({
      id: uuid(202),
      loanId: A,
      personId: ANA,
      status: "PENDING_REVIEW",
      amountCents: 300,
      createdAt: "2026-11-19T11:00:00Z",
    });
    const { body } = await today();
    expect(body.pendingReview.items.map((item) => [item.loanNumber, item.personName])).toEqual([
      ["2026-0002", "Carlos Moraes"],
      ["2026-0001", "Ana Souza"],
    ]);
  });

  it("C12: without pending payments the block is {count 0, totalCents 0, items []}", async () => {
    await seedLoan(A, "2026-0001", ANA, "ACTIVE");
    const { body } = await today();
    expect(body.pendingReview).toEqual({ count: 0, totalCents: 0, items: [] });
  });
});
