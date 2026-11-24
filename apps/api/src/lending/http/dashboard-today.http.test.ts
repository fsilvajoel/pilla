import type { PGlite } from "@electric-sql/pglite";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { bps, cents, isoDate, lateChargesAt, type LateTerms } from "@pilla/finance";
import { dashboardTodayResponse, type DashboardTodayResponse } from "@pilla/schemas";
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
const ANA = uuid(1);
const CARLOS = uuid(2);
const ACCOUNT = uuid(3);
const USER = uuid(4);
let counter = 100;
const nextId = (): string => uuid(++counter);

// Hoje em Brasília: 2026-11-20 (a semana vai de 2026-11-21 a 2026-11-27).
const TODAY = "2026-11-20";
const WEEK_END = "2026-11-27";

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

type SeedLoan = { id: string; number: string; status?: string; personId?: string; graceDays?: number };

async function seedLoan(loan: SeedLoan): Promise<string> {
  const status = loan.status ?? "ACTIVE";
  const draft = status === "DRAFT";
  await client.query(
    `insert into lending.loans
       (id, loan_number, person_id, type, status, principal_cents, monthly_interest_rate_bps, installment_count,
        frequency_unit, frequency_interval, first_due_date, contracted_at, disbursed_at, account_id,
        late_fee_bps, late_interest_monthly_bps, grace_period_days, rounding_step_cents)
     values ($1, $2, $3, 'INSTALLMENT', $4, 500000, 633, 5, 'MONTH', 1, '2026-09-20', '2026-08-15', $5, $6,
        250, 120, $7, 500)`,
    [
      loan.id,
      loan.number,
      loan.personId ?? ANA,
      status,
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
  amounts: { principal: number; interest: number },
  status = "CONFIRMED",
): Promise<void> {
  const paymentId = nextId();
  await client.query(
    `insert into payments.payments (id, loan_id, person_id, account_id, paid_at, amount_cents, method, channel, status, created_by)
     values ($1, $2, $3, $4, '2026-11-01', 1000, 'CASH', 'ADMIN', $5, $6)`,
    [paymentId, loanId, ANA, ACCOUNT, status, USER],
  );
  await client.query(
    `insert into payments.payment_allocations
       (id, payment_id, loan_id, installment_id, late_charges_cents, interest_cents, principal_cents)
     values ($1, $2, $3, $4, 0, $5, $6)`,
    [nextId(), paymentId, loanId, installmentId, amounts.interest, amounts.principal],
  );
}

/** Encargos esperados de uma parcela de 1.200,00 (ou do que sobrou dela) segundo @pilla/finance, na data de hoje. */
function expectedCharges(dueDate: string, openPrincipal: number, openInterest: number, graceDays = 0): number {
  const terms: LateTerms = {
    finePercent: bps(250n),
    lateInterestMonthlyRate: bps(120n),
    graceDays,
    roundingStep: cents(500n),
  };
  const open = {
    number: 1,
    dueDate: isoDate(dueDate),
    openPrincipal: cents(BigInt(openPrincipal)),
    openInterest: cents(BigInt(openInterest)),
  };
  return Number(lateChargesAt(open, terms, isoDate(TODAY)));
}

async function today(): Promise<{ status: number; body: DashboardTodayResponse }> {
  const res = await admin.get("/api/v1/dashboard/today");
  return { status: res.status, body: res.body as DashboardTodayResponse };
}

const A = uuid(11);
const B = uuid(12);
const D = uuid(13);

const dueOf = (block: { items: { loanNumber: string; installmentNumber: number }[] }): string[] =>
  block.items.map((item) => `${item.loanNumber}#${String(item.installmentNumber)}`);

describe("GET /api/v1/dashboard/today buckets (E13-F02A, A1 to A4, A14, A15)", () => {
  it("C1 (A1, A15): an empty database answers 200 with the dates and four empty blocks", async () => {
    const { status, body } = await today();
    const empty = { count: 0, totalCents: 0, items: [] };
    expect(status).toBe(200);
    expect(dashboardTodayResponse.safeParse(body).success).toBe(true);
    expect(body).toEqual({
      referenceDate: TODAY,
      weekEndDate: WEEK_END,
      dueToday: empty,
      dueThisWeek: empty,
      overdue: empty,
      pendingReview: empty,
    });
  });

  it("C2 (A1): an open installment due today is in dueToday with the person and the contract", async () => {
    await seedLoan({ id: A, number: "2026-0001" });
    await seedInstallment(A, 1, TODAY);
    const { status, body } = await today();
    expect(status).toBe(200);
    expect(dashboardTodayResponse.safeParse(body).success).toBe(true);
    expect(body.dueToday.items).toEqual([
      {
        loanId: A,
        loanNumber: "2026-0001",
        personId: ANA,
        personName: "Ana Souza",
        installmentNumber: 1,
        dueDate: TODAY,
        openCents: 120000,
        status: "OPEN",
      },
    ]);
    expect(body.dueThisWeek.count).toBe(0);
    expect(body.overdue.count).toBe(0);
  });

  it("C3 (A2): tomorrow and today plus 7 are in dueThisWeek; today plus 8 and later are in no block", async () => {
    await seedLoan({ id: A, number: "2026-0001" });
    await seedInstallment(A, 1, "2026-11-21");
    await seedInstallment(A, 2, "2026-11-27");
    await seedInstallment(A, 3, "2026-11-28");
    await seedInstallment(A, 4, "2026-12-20");
    const { body } = await today();
    expect(dueOf(body.dueThisWeek)).toEqual(["2026-0001#1", "2026-0001#2"]);
    expect(body.dueToday.count).toBe(0);
    expect(body.overdue.count).toBe(0);
  });

  it("C4 (A2): the installment due today is not repeated in dueThisWeek", async () => {
    await seedLoan({ id: A, number: "2026-0001" });
    await seedInstallment(A, 1, TODAY);
    await seedInstallment(A, 2, "2026-11-21");
    const { body } = await today();
    expect(dueOf(body.dueToday)).toEqual(["2026-0001#1"]);
    expect(dueOf(body.dueThisWeek)).toEqual(["2026-0001#2"]);
  });

  it("C5 (A3): an installment due yesterday is in overdue and not in the due blocks", async () => {
    await seedLoan({ id: A, number: "2026-0001" });
    await seedInstallment(A, 1, "2026-11-19");
    const { body } = await today();
    expect(dueOf(body.overdue)).toEqual(["2026-0001#1"]);
    expect(body.dueToday.count).toBe(0);
    expect(body.dueThisWeek.count).toBe(0);
  });

  it("C6 (A4): a fully paid installment is in no block", async () => {
    await seedLoan({ id: A, number: "2026-0001" });
    const paid = await seedInstallment(A, 1, "2026-11-19");
    await seedPayment(A, paid, { principal: 100000, interest: 20000 });
    const { body } = await today();
    expect(body.overdue.count).toBe(0);
    expect(body.dueToday.count).toBe(0);
  });

  it("C7 (A4): installments of DRAFT, CANCELLED, PAID_OFF and WRITTEN_OFF loans are in no block", async () => {
    const statuses = ["DRAFT", "CANCELLED", "PAID_OFF", "WRITTEN_OFF"];
    for (const [index, status] of statuses.entries()) {
      const id = uuid(20 + index);
      await seedLoan({ id, number: `2026-010${String(index)}`, status });
      await seedInstallment(id, 1, TODAY);
      await seedInstallment(id, 2, "2026-11-22");
      await seedInstallment(id, 3, "2026-11-10");
    }
    const { body } = await today();
    expect(body.dueToday.count).toBe(0);
    expect(body.dueThisWeek.count).toBe(0);
    expect(body.overdue.count).toBe(0);
  });

  it("C8 (A4): installments of an ACTIVE loan are listed next to the ignored ones", async () => {
    await seedLoan({ id: A, number: "2026-0001" });
    await seedInstallment(A, 1, TODAY);
    await seedLoan({ id: B, number: "2026-0002", status: "CANCELLED" });
    await seedInstallment(B, 1, TODAY);
    const { body } = await today();
    expect(dueOf(body.dueToday)).toEqual(["2026-0001#1"]);
  });
});

describe("GET /api/v1/dashboard/today amounts (E13-F02A, A5, A6)", () => {
  it("C9 (A5): openCents discounts the confirmed allocations and a partial payment gives PARTIAL", async () => {
    await seedLoan({ id: A, number: "2026-0001" });
    const due = await seedInstallment(A, 1, TODAY);
    await seedPayment(A, due, { principal: 40000, interest: 20000 });
    const { body } = await today();
    expect(body.dueToday.items).toHaveLength(1);
    expect(body.dueToday.items[0]).toMatchObject({ openCents: 60000, status: "PARTIAL" });
  });

  it("C9 (A5): a partially paid installment due this week is PARTIAL with the open balance", async () => {
    await seedLoan({ id: A, number: "2026-0001" });
    const soon = await seedInstallment(A, 1, "2026-11-23");
    await seedPayment(A, soon, { principal: 40000, interest: 20000 });
    const { body } = await today();
    expect(body.dueThisWeek.items[0]).toMatchObject({ openCents: 60000, status: "PARTIAL" });
  });

  it("C9 (A4): an ACTIVE loan without installments adds nothing to the blocks", async () => {
    await seedLoan({ id: A, number: "2026-0001" });
    const { status, body } = await today();
    expect(status).toBe(200);
    expect(body.dueToday.count + body.dueThisWeek.count + body.overdue.count).toBe(0);
  });

  it("C10 (A5): a partially paid overdue installment is OVERDUE_PARTIAL with the open balance", async () => {
    await seedLoan({ id: A, number: "2026-0001" });
    const late = await seedInstallment(A, 1, "2026-11-10");
    await seedPayment(A, late, { principal: 40000, interest: 20000 });
    const { body } = await today();
    expect(body.overdue.items[0]).toMatchObject({ openCents: 60000, status: "OVERDUE_PARTIAL" });
  });

  it("C11 (A5): payments awaiting review do not reduce the open amount", async () => {
    await seedLoan({ id: A, number: "2026-0001" });
    const due = await seedInstallment(A, 1, TODAY);
    await seedPayment(A, due, { principal: 100000, interest: 20000 }, "PENDING_REVIEW");
    const { body } = await today();
    expect(body.dueToday.items[0]).toMatchObject({ openCents: 120000, status: "OPEN" });
  });

  it("C12 (A6): count and totalCents of dueToday and dueThisWeek match the items", async () => {
    await seedLoan({ id: A, number: "2026-0001" });
    await seedInstallment(A, 1, TODAY);
    await seedLoan({ id: B, number: "2026-0002", personId: CARLOS });
    const partial = await seedInstallment(B, 1, TODAY);
    await seedPayment(B, partial, { principal: 40000, interest: 20000 });
    await seedInstallment(B, 2, "2026-11-23");
    await seedInstallment(B, 3, "2026-11-24");
    const { body } = await today();
    expect(body.dueToday.count).toBe(2);
    expect(body.dueToday.totalCents).toBe(120000 + 60000);
    expect(body.dueThisWeek.count).toBe(2);
    expect(body.dueThisWeek.totalCents).toBe(240000);
  });

  it("C13 (A6): the overdue total is the sum of totalDueCents", async () => {
    await seedLoan({ id: A, number: "2026-0001" });
    await seedInstallment(A, 1, "2026-11-19");
    await seedInstallment(A, 2, "2026-11-10");
    const { body } = await today();
    expect(body.overdue.count).toBe(2);
    expect(body.overdue.totalCents).toBe(body.overdue.items.reduce((sum, item) => sum + item.totalDueCents, 0));
  });
});

describe("GET /api/v1/dashboard/today overdue (E13-F02A, A7 to A9)", () => {
  it("C14 (A7): daysOverdue is today minus the due date, across a month boundary", async () => {
    await seedLoan({ id: A, number: "2026-0001" });
    await seedInstallment(A, 1, "2026-11-19");
    await seedInstallment(A, 2, "2026-10-31");
    const { body } = await today();
    const days = new Map(body.overdue.items.map((item) => [item.installmentNumber, item.daysOverdue]));
    expect(days.get(1)).toBe(1);
    expect(days.get(2)).toBe(20);
  });

  it("C15 (A8): with grace 0, one day late already has charges equal to @pilla/finance", async () => {
    await seedLoan({ id: A, number: "2026-0001" });
    await seedInstallment(A, 1, "2026-11-19");
    const { body } = await today();
    const charges = expectedCharges("2026-11-19", 100000, 20000);
    expect(charges).toBeGreaterThan(0);
    expect(body.overdue.items[0]).toMatchObject({
      daysOverdue: 1,
      openCents: 120000,
      lateChargesCents: charges,
      totalDueCents: 120000 + charges,
      status: "OVERDUE",
    });
  });

  it("C16 (A8): charges are computed on the open balance, not on the whole installment", async () => {
    await seedLoan({ id: A, number: "2026-0001" });
    const late = await seedInstallment(A, 1, "2026-11-10");
    await seedPayment(A, late, { principal: 40000, interest: 20000 });
    const { body } = await today();
    const charges = expectedCharges("2026-11-10", 60000, 0);
    expect(charges).toBeGreaterThan(0);
    expect(charges).toBeLessThan(expectedCharges("2026-11-10", 100000, 20000));
    expect(body.overdue.items[0]).toMatchObject({ lateChargesCents: charges, totalDueCents: 60000 + charges });
  });

  it("C17 (A9): with grace 3 the installment is overdue with no charges from day 1 to day 3", async () => {
    await seedLoan({ id: A, number: "2026-0001", graceDays: 3 });
    await seedInstallment(A, 1, "2026-11-19");
    await seedInstallment(A, 2, "2026-11-18");
    await seedInstallment(A, 3, "2026-11-17");
    const { body } = await today();
    expect(body.overdue.items.map((item) => [item.daysOverdue, item.lateChargesCents, item.totalDueCents])).toEqual([
      [3, 0, 120000],
      [2, 0, 120000],
      [1, 0, 120000],
    ]);
    expect(body.overdue.items.every((item) => item.status === "OVERDUE")).toBe(true);
  });

  it("C18 (A9): with grace 3 the charges start on day 4", async () => {
    await seedLoan({ id: A, number: "2026-0001", graceDays: 3 });
    await seedInstallment(A, 1, "2026-11-16");
    const { body } = await today();
    const charges = expectedCharges("2026-11-16", 100000, 20000, 3);
    expect(charges).toBeGreaterThan(0);
    expect(body.overdue.items[0]).toMatchObject({
      daysOverdue: 4,
      lateChargesCents: charges,
      totalDueCents: 120000 + charges,
    });
  });

  it("C19 (A9): the grace of each loan applies to its own installments", async () => {
    await seedLoan({ id: A, number: "2026-0001", graceDays: 0 });
    await seedInstallment(A, 1, "2026-11-18");
    await seedLoan({ id: B, number: "2026-0002", graceDays: 5 });
    await seedInstallment(B, 1, "2026-11-18");
    const { body } = await today();
    const byLoan = new Map(body.overdue.items.map((item) => [item.loanNumber, item.lateChargesCents]));
    expect(byLoan.get("2026-0001")).toBe(expectedCharges("2026-11-18", 100000, 20000));
    expect(byLoan.get("2026-0001")).toBeGreaterThan(0);
    expect(byLoan.get("2026-0002")).toBe(0);
  });
});

describe("GET /api/v1/dashboard/today order (E13-F02A, A13)", () => {
  it("C20 (A13): dueToday is ordered by loan number, then installment number", async () => {
    await seedLoan({ id: B, number: "2026-0002" });
    await seedInstallment(B, 1, TODAY);
    await seedLoan({ id: A, number: "2026-0001" });
    await seedInstallment(A, 2, TODAY);
    await seedInstallment(A, 1, TODAY);
    const { body } = await today();
    expect(dueOf(body.dueToday)).toEqual(["2026-0001#1", "2026-0001#2", "2026-0002#1"]);
  });

  it("C21 (A13): dueThisWeek is ordered by due date, ties by loan number", async () => {
    await seedLoan({ id: B, number: "2026-0002" });
    await seedInstallment(B, 1, "2026-11-22");
    await seedLoan({ id: A, number: "2026-0001" });
    await seedInstallment(A, 1, "2026-11-25");
    await seedInstallment(A, 2, "2026-11-22");
    await seedInstallment(A, 3, "2026-11-21");
    const { body } = await today();
    expect(dueOf(body.dueThisWeek)).toEqual(["2026-0001#3", "2026-0001#2", "2026-0002#1", "2026-0001#1"]);
  });

  it("C22 (A13): overdue is ordered by daysOverdue descending, ties by loan number then installment number", async () => {
    await seedLoan({ id: B, number: "2026-0002" });
    await seedInstallment(B, 1, "2026-11-18");
    await seedLoan({ id: A, number: "2026-0001" });
    await seedInstallment(A, 1, "2026-11-19");
    await seedInstallment(A, 2, "2026-11-18");
    await seedInstallment(A, 3, "2026-11-01");
    const { body } = await today();
    expect(dueOf(body.overdue)).toEqual(["2026-0001#3", "2026-0001#2", "2026-0002#1", "2026-0001#1"]);
  });
});

describe("GET /api/v1/dashboard/today storage (E13-F02A, A15)", () => {
  it("C24 (A15): the call writes no row in any table", async () => {
    await seedLoan({ id: A, number: "2026-0001" });
    await seedInstallment(A, 1, "2026-11-10");
    await seedInstallment(A, 2, TODAY);
    const tables = [
      "lending.loans",
      "lending.installments",
      "payments.payments",
      "payments.payment_allocations",
      "people.persons",
    ];
    const counts = async (): Promise<number[]> => {
      const result: number[] = [];
      for (const table of tables) {
        const rows = await client.query<{ n: number }>(`select count(*)::int as n from ${table}`);
        result.push(rows.rows[0]?.n ?? -1);
      }
      return result;
    };
    const before = await counts();
    const first = await today();
    const second = await today();
    expect(first.status).toBe(200);
    expect(second.body).toEqual(first.body);
    expect(await counts()).toEqual(before);
  });
});

describe("GET /api/v1/dashboard/today reference date (E13-F02A, D3)", () => {
  it("C25: today is the date in Brasília, not in UTC (02:00Z of the 21st is still the 20th)", async () => {
    vi.setSystemTime(new Date("2026-11-21T02:00:00Z"));
    await seedLoan({ id: A, number: "2026-0001" });
    await seedInstallment(A, 1, "2026-11-20");
    await seedInstallment(A, 2, "2026-11-21");
    const { body } = await today();
    expect(body.referenceDate).toBe("2026-11-20");
    expect(dueOf(body.dueToday)).toEqual(["2026-0001#1"]);
    expect(dueOf(body.dueThisWeek)).toEqual(["2026-0001#2"]);
  });

  it("C26: right after midnight in Brasília the reference date moves to the next day", async () => {
    vi.setSystemTime(new Date("2026-11-21T03:30:00Z"));
    await seedLoan({ id: A, number: "2026-0001" });
    await seedInstallment(A, 1, "2026-11-20");
    const { body } = await today();
    expect(body.referenceDate).toBe("2026-11-21");
    expect(body.weekEndDate).toBe("2026-11-28");
    expect(dueOf(body.overdue)).toEqual(["2026-0001#1"]);
  });

  it("C27: an unknown query parameter is ignored", async () => {
    await seedLoan({ id: D, number: "2026-0003" });
    await seedInstallment(D, 1, TODAY);
    const res = await admin.get("/api/v1/dashboard/today?foo=bar");
    expect(res.status).toBe(200);
  });
});
