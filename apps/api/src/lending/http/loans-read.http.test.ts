import type { PGlite } from "@electric-sql/pglite";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { loanDetailResponse, loanListResponse } from "@pilla/schemas";
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
let counter = 100;
const nextId = (): string => uuid(++counter);

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
  // Hoje em Brasília: 2026-11-20.
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

type SeedLoan = {
  id: string;
  number: string;
  status?: string;
  personId?: string;
  graceDays?: number;
  type?: string;
  unit?: string;
  count?: number | null;
};

async function seedLoan(loan: SeedLoan): Promise<string> {
  const status = loan.status ?? "ACTIVE";
  const draft = status === "DRAFT";
  await client.query(
    `insert into lending.loans
       (id, loan_number, person_id, type, status, principal_cents, monthly_interest_rate_bps, installment_count,
        frequency_unit, frequency_interval, first_due_date, contracted_at, disbursed_at, account_id,
        late_fee_bps, late_interest_monthly_bps, grace_period_days, rounding_step_cents)
     values ($1, $2, $3, $4, $5, 500000, 633, $6, $7, 1, '2026-09-20', '2026-08-15', $8, $9, 250, 120, $10, 500)`,
    [
      loan.id,
      loan.number,
      loan.personId ?? ANA,
      loan.type ?? "INSTALLMENT",
      status,
      loan.count === undefined ? 5 : loan.count,
      loan.unit ?? "MONTH",
      draft ? null : "2026-08-20",
      draft ? null : ACCOUNT,
      loan.graceDays ?? 0,
    ],
  );
  return loan.id;
}

// Parcela de 1.200,00 (principal 1.000,00 e juros 200,00).
async function seedInstallment(loanId: string, number: number, dueDate: string): Promise<string> {
  const id = nextId();
  await client.query(
    `insert into lending.installments (id, loan_id, number, due_date, principal_cents, interest_cents, total_cents)
     values ($1, $2, $3, $4, 100000, 20000, 120000)`,
    [id, loanId, number, dueDate],
  );
  return id;
}

async function seedPayment(
  loanId: string,
  installmentId: string,
  amounts: { principal: number; interest: number; lateCharges?: number },
  options: { status?: string; allocationReversed?: boolean } = {},
): Promise<void> {
  const paymentId = nextId();
  await client.query(
    `insert into payments.payments (id, loan_id, person_id, account_id, paid_at, amount_cents, method, channel, status, created_by)
     values ($1, $2, $3, $4, '2026-11-01', 1000, 'CASH', 'ADMIN', $5, $6)`,
    [paymentId, loanId, ANA, ACCOUNT, options.status ?? "CONFIRMED", USER],
  );
  await client.query(
    `insert into payments.payment_allocations
       (id, payment_id, loan_id, installment_id, late_charges_cents, interest_cents, principal_cents, reversed_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      nextId(),
      paymentId,
      loanId,
      installmentId,
      amounts.lateCharges ?? 0,
      amounts.interest,
      amounts.principal,
      options.allocationReversed === true ? "2026-11-05T10:00:00Z" : null,
    ],
  );
}

// Contrato A: 1 paga; 2 paga em parte e vencida; 3 vencida ontem; 4 vence hoje; 5 futura.
async function seedContractA(id: string, number = "2026-0001"): Promise<string[]> {
  await seedLoan({ id, number });
  const ids = [
    await seedInstallment(id, 1, "2026-09-20"),
    await seedInstallment(id, 2, "2026-10-20"),
    await seedInstallment(id, 3, "2026-11-19"),
    await seedInstallment(id, 4, "2026-11-20"),
    await seedInstallment(id, 5, "2026-12-20"),
  ];
  await seedPayment(id, ids[0] ?? "", { principal: 100000, interest: 20000 });
  await seedPayment(id, ids[1] ?? "", { principal: 40000, interest: 20000 });
  return ids;
}

type ListBody = {
  items: {
    id: string;
    loanNumber: string;
    personName: string;
    outstandingCents: number;
    status: string;
    standing: string | null;
    nextDueDate: string | null;
  }[];
  nextCursor: string | null;
  code?: string;
  errors?: { field: string }[];
};

async function list(query = ""): Promise<{ status: number; body: ListBody }> {
  const res = await request(baseUrl).get(`/api/v1/loans${query}`);
  return { status: res.status, body: res.body as ListBody };
}

const numbers = (body: ListBody): string[] => body.items.map((item) => item.loanNumber);

const A = uuid(11);
const B = uuid(12);
const D = uuid(13);
const E = uuid(14);
const F = uuid(15);

async function seedFiveLoans(): Promise<void> {
  await seedContractA(A, "2026-0001");
  await seedLoan({ id: B, number: "2026-0002", graceDays: 5 });
  await seedInstallment(B, 1, "2026-11-17");
  await seedLoan({ id: D, number: "2026-0003" });
  await seedInstallment(D, 1, "2026-12-20");
  await seedLoan({ id: E, number: "2026-0004", status: "PAID_OFF", personId: CARLOS });
  await seedLoan({ id: F, number: "2026-0005", status: "DRAFT", personId: CARLOS });
}

describe("GET /api/v1/loans (E10-F05, A1 to A3)", () => {
  it("C1 (A3): lists newest first with personName, outstanding and next due date", async () => {
    await seedFiveLoans();
    const { status, body } = await list();
    expect(status).toBe(200);
    expect(loanListResponse.safeParse(body).success).toBe(true);
    expect(numbers(body)).toEqual(["2026-0005", "2026-0004", "2026-0003", "2026-0002", "2026-0001"]);
    expect(body.items.map((item) => item.personName)).toEqual([
      "Carlos Moraes",
      "Carlos Moraes",
      "Ana Souza",
      "Ana Souza",
      "Ana Souza",
    ]);
    expect(body.nextCursor).toBeNull();
  });

  it("C2: outstandingCents and nextDueDate are computed for ACTIVE and empty otherwise", async () => {
    await seedFiveLoans();
    const { body } = await list();
    const byNumber = new Map(body.items.map((item) => [item.loanNumber, item]));
    expect(byNumber.get("2026-0001")).toMatchObject({
      outstandingCents: 425000,
      nextDueDate: "2026-10-20",
      standing: "OVERDUE",
    });
    expect(byNumber.get("2026-0003")).toMatchObject({
      outstandingCents: 120000,
      nextDueDate: "2026-12-20",
      standing: "CURRENT",
    });
    expect(byNumber.get("2026-0004")).toMatchObject({ outstandingCents: 0, nextDueDate: null, standing: null });
    expect(byNumber.get("2026-0005")).toMatchObject({ status: "DRAFT", standing: null });
  });

  it("C3 (A1): filters by personId and by status", async () => {
    await seedFiveLoans();
    expect(numbers((await list(`?personId=${CARLOS}`)).body)).toEqual(["2026-0005", "2026-0004"]);
    expect(numbers((await list("?status=ACTIVE")).body)).toEqual(["2026-0003", "2026-0002", "2026-0001"]);
    expect((await list(`?personId=${uuid(99)}`)).body.items).toEqual([]);
  });

  it("C4 (A1, A6): filters by standing, with OVERDUE right after the due date even in grace", async () => {
    await seedFiveLoans();
    expect(numbers((await list("?standing=OVERDUE")).body)).toEqual(["2026-0002", "2026-0001"]);
    expect(numbers((await list("?standing=CURRENT")).body)).toEqual(["2026-0003"]);
  });

  it("C5 (A2): the cursor pages without repeating items", async () => {
    await seedFiveLoans();
    const first = await list("?limit=2");
    expect(numbers(first.body)).toEqual(["2026-0005", "2026-0004"]);
    expect(first.body.nextCursor).not.toBeNull();
    const second = await list(`?limit=2&cursor=${encodeURIComponent(first.body.nextCursor ?? "")}`);
    expect(numbers(second.body)).toEqual(["2026-0003", "2026-0002"]);
    const third = await list(`?limit=2&cursor=${encodeURIComponent(second.body.nextCursor ?? "")}`);
    expect(numbers(third.body)).toEqual(["2026-0001"]);
    expect(third.body.nextCursor).toBeNull();
  });

  it("C5 (A2): the cursor also works with the standing filter, reading more than one batch", async () => {
    await seedFiveLoans();
    const first = await list("?limit=1&standing=OVERDUE");
    expect(numbers(first.body)).toEqual(["2026-0002"]);
    const second = await list(`?limit=1&standing=OVERDUE&cursor=${encodeURIComponent(first.body.nextCursor ?? "")}`);
    expect(numbers(second.body)).toEqual(["2026-0001"]);
    expect(second.body.nextCursor).toBeNull();
  });

  it("C6: rejects an invalid cursor, limit, status, personId and unknown key with 400", async () => {
    const badCursor = await list(`?cursor=${Buffer.from("abc", "utf8").toString("base64")}`);
    expect(badCursor.status).toBe(400);
    expect(badCursor.body.errors?.map((e) => e.field)).toEqual(["cursor"]);
    expect((await list("?limit=0")).status).toBe(400);
    expect((await list("?status=OPEN")).status).toBe(400);
    expect((await list("?personId=x")).status).toBe(400);
    expect((await list("?foo=1")).status).toBe(400);
  });

  it("C6: a loan whose person no longer exists answers 500", async () => {
    await seedLoan({ id: D, number: "2026-0003", personId: uuid(98) });
    expect((await list()).status).toBe(500);
  });
});

type DetailBody = {
  version: number;
  status?: string;
  standing: string | null;
  paidCents: number;
  totalCents: number;
  interestCents: number;
  outstandingCents: number;
  installmentCount: number;
  frequency: { unit: string };
  disbursedAt: string | null;
  personName: string;
  installments: { number: number; paidCents: number; lateChargesCents: number; status: string }[];
  code?: string;
};

async function detail(id: string): Promise<{ status: number; body: DetailBody }> {
  const res = await request(baseUrl).get(`/api/v1/loans/${id}`);
  return { status: res.status, body: res.body as DetailBody };
}

describe("GET /api/v1/loans/{id} (E10-F05, A4 to A6)", () => {
  it("C7 (A5): late charges at today on the open balance of each installment, statuses and totals", async () => {
    await seedContractA(A);
    const { status, body } = await detail(A);
    expect(status).toBe(200);
    expect(loanDetailResponse.safeParse(body).success).toBe(true);
    expect(body.installments.map((i) => i.status)).toEqual(["PAID", "OVERDUE_PARTIAL", "OVERDUE", "OPEN", "OPEN"]);
    // Parcela 2: em aberto 60.000 há 31 dias = multa 1.500 + mora 744 = 2.244, arredondado a 2.000 (não sobre 120.000).
    // Parcela 3: em aberto 120.000 há 1 dia = multa 3.000 + mora 48 = 3.048, arredondado a 3.000.
    expect(body.installments.map((i) => i.lateChargesCents)).toEqual([0, 2000, 3000, 0, 0]);
    expect(body).toMatchObject({
      personName: "Ana Souza",
      standing: "OVERDUE",
      totalCents: 600000,
      interestCents: 100000,
      paidCents: 180000,
      outstandingCents: 425000,
    });
  });

  it("C7b: exposes the real row version, so an edit bumps it and activate works with the new one", async () => {
    await client.query("insert into treasury.accounts (id, name, active) values ($1, 'Conta ativa', true)", [ACCOUNT]);
    await seedLoan({ id: A, number: "2026-0001", status: "DRAFT" });
    expect((await detail(A)).body.version).toBe(1);
    const edited = await request(baseUrl).patch(`/api/v1/loans/${A}`).set("If-Match", "1").send({ gracePeriodDays: 5 });
    expect(edited.status).toBe(200);
    const after = await detail(A);
    expect(after.body.version).toBe(2);
    const activated = await request(baseUrl)
      .post(`/api/v1/loans/${A}/activate`)
      .set("If-Match", String(after.body.version))
      .send({ disbursedAt: "2026-08-20", accountId: ACCOUNT });
    expect(activated.status).toBe(200);
    expect((await detail(A)).body.version).toBe(3);
  });

  it("C8 (A4): paidCents counts the confirmed allocations of each installment", async () => {
    const ids = await seedContractA(A);
    const { body } = await detail(A);
    expect(body.installments.map((i) => i.paidCents)).toEqual([120000, 60000, 0, 0, 0]);
    expect(ids).toHaveLength(5);
  });

  it("C9 (A4): ignores a pending payment and a reversed allocation", async () => {
    await seedLoan({ id: A, number: "2026-0001" });
    const first = await seedInstallment(A, 1, "2026-12-20");
    const second = await seedInstallment(A, 2, "2027-01-20");
    await seedPayment(A, first, { principal: 100000, interest: 20000 }, { status: "PENDING_REVIEW" });
    await seedPayment(A, second, { principal: 100000, interest: 20000 }, { allocationReversed: true });
    const { body } = await detail(A);
    expect(body.paidCents).toBe(0);
    expect(body.installments.map((i) => i.status)).toEqual(["OPEN", "OPEN"]);
    expect(body.outstandingCents).toBe(240000);
  });

  it("C10 (A6): OVERDUE right after the due date; the grace period only exempts the late charges", async () => {
    await seedLoan({ id: B, number: "2026-0002", graceDays: 5 });
    await seedInstallment(B, 1, "2026-11-17");
    const { body } = await detail(B);
    expect(body.installments).toMatchObject([{ status: "OVERDUE", lateChargesCents: 0 }]);
    expect(body.standing).toBe("OVERDUE");
    expect(body.outstandingCents).toBe(120000);
  });

  it("C11 (A6): an installment due today is not overdue and the loan is CURRENT", async () => {
    await seedLoan({ id: D, number: "2026-0003" });
    await seedInstallment(D, 1, "2026-11-20");
    const { body } = await detail(D);
    expect(body.installments).toMatchObject([{ status: "OPEN", lateChargesCents: 0 }]);
    expect(body.standing).toBe("CURRENT");
  });

  it("C12: a reversal brings the installment back to open, partial or overdue", async () => {
    await seedLoan({ id: A, number: "2026-0001" });
    const first = await seedInstallment(A, 1, "2026-11-19");
    const second = await seedInstallment(A, 2, "2026-12-20");
    await seedPayment(A, first, { principal: 100000, interest: 20000 }, { allocationReversed: true });
    await seedPayment(A, second, { principal: 10000, interest: 0 });
    const { body } = await detail(A);
    expect(body.installments.map((i) => i.status)).toEqual(["OVERDUE", "PARTIAL"]);
    expect(body.installments.map((i) => i.paidCents)).toEqual([0, 10000]);
  });

  it("C12: a non ACTIVE loan has no standing, late charges or outstanding balance", async () => {
    await seedLoan({ id: E, number: "2026-0004", status: "PAID_OFF" });
    await seedInstallment(E, 1, "2026-11-01");
    const { body } = await detail(E);
    expect(body).toMatchObject({ standing: null, outstandingCents: 0 });
    expect(body.installments).toMatchObject([{ status: "OPEN", lateChargesCents: 0 }]);
  });

  it("C12: a DRAFT has no installments and a DAY frequency is kept", async () => {
    await seedLoan({ id: F, number: "2026-0005", status: "DRAFT", unit: "DAY", type: "SINGLE_PAYMENT", count: 1 });
    const { status, body } = await detail(F);
    expect(status).toBe(200);
    expect(body).toMatchObject({
      installments: [],
      disbursedAt: null,
      installmentCount: 1,
      frequency: { unit: "DAY" },
    });
  });

  it("C12: answers 404 for an unknown loan and 400 for a malformed id", async () => {
    expect((await detail(uuid(97))).status).toBe(404);
    expect((await detail("x")).status).toBe(400);
  });

  it("C12: a loan type outside the public contract answers 500", async () => {
    await seedLoan({ id: A, number: "2026-0001", type: "CUSTOM" });
    expect((await detail(A)).status).toBe(500);
  });

  it("C12: a loan whose person no longer exists answers 500", async () => {
    await seedLoan({ id: A, number: "2026-0001", personId: uuid(98) });
    expect((await detail(A)).status).toBe(500);
  });
});
