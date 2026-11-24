import type { PGlite } from "@electric-sql/pglite";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { allocationPreviewResponse } from "@pilla/schemas";
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
const SUCCESSOR = uuid(12);
let counter = 100;
const nextId = (): string => uuid(++counter);

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
  // Hoje em Brasília: 2026-11-20.
  vi.setSystemTime(new Date("2026-11-20T15:00:00Z"));
  await client.query("delete from payments.payment_allocations");
  await client.query("delete from payments.payments");
  await client.query("delete from lending.installments");
  await client.query("delete from lending.loans");
  await client.query("delete from core.outbox");
  await client.query("delete from core.audit_log");
  await client.query("delete from people.persons");
  await client.query(
    "insert into people.persons (id, full_name, cpf, phone) values ($1, 'Ana Souza', '52998224725', '+5511987654321')",
    [PERSON],
  );
});
afterEach(() => {
  vi.useRealTimers();
});

async function seedLoan(id: string, number: string, status: string, origin: string | null = null): Promise<void> {
  const settled = status === "DRAFT" || status === "CANCELLED";
  await client.query(
    `insert into lending.loans
       (id, loan_number, person_id, type, status, principal_cents, monthly_interest_rate_bps, installment_count,
        frequency_unit, frequency_interval, first_due_date, contracted_at, disbursed_at, account_id,
        origin_loan_id, origin_type, late_fee_bps, late_interest_monthly_bps, grace_period_days, rounding_step_cents)
     values ($1, $2, $3, 'INSTALLMENT', $4, 500000, 633, 5, 'MONTH', 1, '2026-09-20', '2026-08-15',
        $5, $6, $7, $8, 250, 120, 0, 500)`,
    [
      id,
      number,
      PERSON,
      status,
      settled ? null : "2026-08-20",
      settled ? null : ACCOUNT,
      origin,
      origin ? "RENEWAL" : null,
    ],
  );
}

type Seed = { readonly withPayments?: boolean; readonly reversed?: boolean };

// Cinco parcelas de 1.200,00 (principal 1.000,00 e juros 200,00), inseridas da última para a primeira.
// Com `withPayments`, a 1 está paga e a 2 recebeu 600,00 de principal e 200,00 de juros: saldo de 4.250,00 em 20/11.
async function seedSchedule(seed: Seed = {}): Promise<void> {
  const dueDates = ["2026-09-20", "2026-10-20", "2026-11-19", "2026-11-20", "2026-12-20"];
  const ids: string[] = [];
  for (const index of [4, 3, 2, 1, 0]) {
    const id = nextId();
    ids[index] = id;
    await client.query(
      `insert into lending.installments (id, loan_id, number, due_date, principal_cents, interest_cents, total_cents)
       values ($1, $2, $3, $4, 100000, 20000, 120000)`,
      [id, LOAN, index + 1, dueDates[index]],
    );
  }
  if (seed.withPayments !== true) return;
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

type Allocation = {
  installmentNumber?: number;
  dueDate?: string;
  lateChargesCents?: number;
  interestCents?: number;
  principalCents?: number;
  installmentStatusAfter?: string;
};
type PreviewBody = {
  loanId?: string;
  loanStatus?: string;
  paidAt?: string;
  amountCents?: number;
  deferred?: boolean;
  isRecovery?: boolean;
  allocations?: Allocation[];
  totals?: { lateChargesCents?: number; interestCents?: number; principalCents?: number };
  outstandingBeforeCents?: number | null;
  outstandingAfterCents?: number | null;
  paysOff?: boolean;
  code?: string;
  successorLoanId?: string;
  errors?: { field: string }[];
};
type Result = { status: number; body: PreviewBody };

async function preview(payload: Record<string, unknown>): Promise<Result> {
  const res = await admin.post("/api/v1/payments/allocation-preview").send(payload);
  return { status: res.status, body: res.body as PreviewBody };
}
const previewOf = (amountCents: number, paidAt = "2026-11-20", loanId = LOAN): Promise<Result> =>
  preview({ loanId, amountCents, paidAt });

async function countRows(): Promise<Record<string, number>> {
  const tables = ["payments.payments", "payments.payment_allocations", "core.outbox", "core.audit_log"];
  const counts: Record<string, number> = {};
  for (const table of tables) {
    const result = await client.query<{ n: string }>(`select count(*)::text as n from ${table}`);
    counts[table] = Number(result.rows[0]?.n);
  }
  return counts;
}

// A prévia recusada ou aceita nunca grava (A11): as quatro tabelas ficam como estavam.
async function expectNothingWritten(call: () => Promise<Result>): Promise<Result> {
  const before = await countRows();
  const result = await call();
  expect(await countRows()).toEqual(before);
  return result;
}

describe("POST /api/v1/payments/allocation-preview: distribution (E11-F01, A1 to A4)", () => {
  it("C1 (A1): the oldest installment is paid first, charges then interest then principal", async () => {
    await seedLoan(LOAN, "2026-0001", "ACTIVE");
    await seedSchedule();
    const { status, body } = await previewOf(126000);
    expect(status).toBe(200);
    expect(allocationPreviewResponse.safeParse(body).success).toBe(true);
    expect(body.allocations).toEqual([
      {
        installmentNumber: 1,
        dueDate: "2026-09-20",
        lateChargesCents: 6000,
        interestCents: 20000,
        principalCents: 100000,
        installmentStatusAfter: "PAID",
      },
    ]);
  });

  it("C2 (A3): a payment smaller than the installment goes to the charges first and leaves it PARTIAL", async () => {
    await seedLoan(LOAN, "2026-0001", "ACTIVE");
    await seedSchedule();
    const { status, body } = await previewOf(5000);
    expect(status).toBe(200);
    expect(body.allocations).toEqual([
      {
        installmentNumber: 1,
        dueDate: "2026-09-20",
        lateChargesCents: 5000,
        interestCents: 0,
        principalCents: 0,
        installmentStatusAfter: "PARTIAL",
      },
    ]);
  });

  it("C3 (A2, A4): the remainder spills to the next installment and the amounts add up to amountCents", async () => {
    await seedLoan(LOAN, "2026-0001", "ACTIVE");
    await seedSchedule();
    const { status, body } = await previewOf(150000);
    expect(status).toBe(200);
    expect(body.allocations).toEqual([
      {
        installmentNumber: 1,
        dueDate: "2026-09-20",
        lateChargesCents: 6000,
        interestCents: 20000,
        principalCents: 100000,
        installmentStatusAfter: "PAID",
      },
      {
        installmentNumber: 2,
        dueDate: "2026-10-20",
        lateChargesCents: 4500,
        interestCents: 19500,
        principalCents: 0,
        installmentStatusAfter: "PARTIAL",
      },
    ]);
    expect(body.totals).toEqual({ lateChargesCents: 10500, interestCents: 39500, principalCents: 100000 });
    expect(10500 + 39500 + 100000).toBe(body.amountCents);
  });

  it("C4 (A1): an overdue installment charges fine and late interest at paidAt before interest and principal", async () => {
    await seedLoan(LOAN, "2026-0001", "ACTIVE");
    await seedSchedule();
    const { body } = await previewOf(7000);
    expect(body.allocations?.[0]).toMatchObject({
      installmentNumber: 1,
      lateChargesCents: 6000,
      interestCents: 1000,
      principalCents: 0,
    });
  });

  it("C5 (A3): paying before the due date is normal: no charges and no discount", async () => {
    await seedLoan(LOAN, "2026-0001", "ACTIVE");
    await seedSchedule();
    const { status, body } = await previewOf(50000, "2026-09-10");
    expect(status).toBe(200);
    expect(body.allocations).toEqual([
      {
        installmentNumber: 1,
        dueDate: "2026-09-20",
        lateChargesCents: 0,
        interestCents: 20000,
        principalCents: 30000,
        installmentStatusAfter: "PARTIAL",
      },
    ]);
  });

  it("C6 (A1): installments come in due-date order whatever the row order, skipping what is already paid", async () => {
    await seedLoan(LOAN, "2026-0001", "ACTIVE");
    await seedSchedule({ withPayments: true });
    const { body } = await previewOf(100000);
    expect(body.allocations?.map((allocation) => allocation.installmentNumber)).toEqual([2, 3]);
    expect(body.allocations?.[0]).toEqual({
      installmentNumber: 2,
      dueDate: "2026-10-20",
      lateChargesCents: 2000,
      interestCents: 0,
      principalCents: 60000,
      installmentStatusAfter: "PAID",
    });
  });

  it("C6: the response echoes the loan, the date and the amount", async () => {
    await seedLoan(LOAN, "2026-0001", "ACTIVE");
    await seedSchedule();
    const { body } = await previewOf(126000);
    expect(body).toMatchObject({
      loanId: LOAN,
      loanStatus: "ACTIVE",
      paidAt: "2026-11-20",
      amountCents: 126000,
      deferred: false,
      isRecovery: false,
    });
  });
});

describe("POST /api/v1/payments/allocation-preview: balances (E11-F01, A5, A6)", () => {
  it("C7 (A5): the balance before equals the loan outstanding balance and the balance after is smaller by the amount", async () => {
    await seedLoan(LOAN, "2026-0001", "ACTIVE");
    await seedSchedule();
    const detail = await admin.get(`/api/v1/loans/${LOAN}`);
    const { body } = await previewOf(100000);
    expect(body.outstandingBeforeCents).toBe(613500);
    expect(body.outstandingBeforeCents).toBe((detail.body as { outstandingCents: number }).outstandingCents);
    expect(body.outstandingAfterCents).toBe(513500);
  });

  it("C7 (A5): confirmed allocations leave the balance of the open installments only", async () => {
    await seedLoan(LOAN, "2026-0001", "ACTIVE");
    await seedSchedule({ withPayments: true });
    const { body } = await previewOf(1000);
    expect(body.outstandingBeforeCents).toBe(425000);
    expect(body.outstandingAfterCents).toBe(424000);
  });

  it("C8 (A6): paysOff is true only when the payment clears the balance", async () => {
    await seedLoan(LOAN, "2026-0001", "ACTIVE");
    await seedSchedule();
    const exact = await previewOf(613500);
    expect(exact.status).toBe(200);
    expect(exact.body.paysOff).toBe(true);
    expect(exact.body.outstandingAfterCents).toBe(0);
    const short = await previewOf(613499);
    expect(short.body.paysOff).toBe(false);
    expect(short.body.outstandingAfterCents).toBe(1);
  });
});

describe("POST /api/v1/payments/allocation-preview: refusals (E11-F01, A7 to A11)", () => {
  it("C9 (A7): an amount above the balance at paidAt answers 422 PAYMENT_EXCEEDS_BALANCE and writes nothing", async () => {
    await seedLoan(LOAN, "2026-0001", "ACTIVE");
    await seedSchedule();
    const { status, body } = await expectNothingWritten(() => previewOf(613501));
    expect(status).toBe(422);
    expect(body.code).toBe("PAYMENT_EXCEEDS_BALANCE");
  });

  it.each(["PAID_OFF", "RENEWED", "RENEGOTIATED", "CANCELLED"])(
    "C10 (A8): a %s loan answers 422 LOAN_CLOSED_FOR_PAYMENTS without successor and writes nothing",
    async (loanStatus) => {
      await seedLoan(LOAN, "2026-0001", loanStatus);
      const { status, body } = await expectNothingWritten(() => previewOf(1000));
      expect(status).toBe(422);
      expect(body.code).toBe("LOAN_CLOSED_FOR_PAYMENTS");
      expect(body.successorLoanId).toBeUndefined();
    },
  );

  it.each(["RENEWED", "RENEGOTIATED"])(
    "C11 (A9): a %s loan with a successor carries successorLoanId and writes nothing",
    async (loanStatus) => {
      await seedLoan(LOAN, "2026-0001", loanStatus);
      await seedLoan(SUCCESSOR, "2026-0002", "DRAFT", LOAN);
      const { status, body } = await expectNothingWritten(() => previewOf(1000));
      expect(status).toBe(422);
      expect(body.code).toBe("LOAN_CLOSED_FOR_PAYMENTS");
      expect(body.successorLoanId).toBe(SUCCESSOR);
    },
  );

  it("C12 (A10): paidAt before the disbursement answers 400 VALIDATION_FAILED on paidAt; the disbursement day is accepted", async () => {
    await seedLoan(LOAN, "2026-0001", "ACTIVE");
    await seedSchedule();
    const before = await expectNothingWritten(() => previewOf(1000, "2026-08-19"));
    expect(before.status).toBe(400);
    expect(before.body.code).toBe("VALIDATION_FAILED");
    expect(before.body.errors?.map((error) => error.field)).toEqual(["paidAt"]);
    expect((await previewOf(1000, "2026-08-20")).status).toBe(200);
  });

  it("C12 (A10): a future paidAt answers 400 VALIDATION_FAILED on paidAt; today in Brasília is accepted", async () => {
    await seedLoan(LOAN, "2026-0001", "ACTIVE");
    await seedSchedule();
    const future = await expectNothingWritten(() => previewOf(1000, "2026-11-21"));
    expect(future.status).toBe(400);
    expect(future.body.errors?.map((error) => error.field)).toEqual(["paidAt"]);
    expect((await previewOf(1000, "2026-11-20")).status).toBe(200);
  });

  it("C13 (A11): an unknown loan answers 404 NOT_FOUND and writes nothing", async () => {
    const { status, body } = await expectNothingWritten(() => previewOf(1000, "2026-11-20", uuid(97)));
    expect(status).toBe(404);
    expect(body.code).toBe("NOT_FOUND");
  });

  it("C14: a malformed body answers 400 VALIDATION_FAILED and writes nothing", async () => {
    await seedLoan(LOAN, "2026-0001", "ACTIVE");
    await seedSchedule();
    const bodies: Record<string, unknown>[] = [
      { loanId: "x", amountCents: 1000, paidAt: "2026-11-20" },
      { loanId: LOAN, amountCents: 0, paidAt: "2026-11-20" },
      { loanId: LOAN, amountCents: -1, paidAt: "2026-11-20" },
      { loanId: LOAN, amountCents: 10.5, paidAt: "2026-11-20" },
      { loanId: LOAN, amountCents: "100", paidAt: "2026-11-20" },
      { loanId: LOAN, amountCents: 1000, paidAt: "2026-13-01" },
      { loanId: LOAN, amountCents: 1000 },
      { loanId: LOAN, amountCents: 1000, paidAt: "2026-11-20", extra: 1 },
    ];
    for (const payload of bodies) {
      const { status, body } = await expectNothingWritten(() => preview(payload));
      expect(status).toBe(400);
      expect(body.code).toBe("VALIDATION_FAILED");
    }
  });
});

describe("POST /api/v1/payments/allocation-preview: DRAFT and WRITTEN_OFF (E11-F01, A12, A13)", () => {
  it("C15 (A12): a DRAFT loan answers 200 deferred with empty allocations and null balances", async () => {
    await seedLoan(LOAN, "2026-0001", "DRAFT");
    const { status, body } = await expectNothingWritten(() => previewOf(50000));
    expect(status).toBe(200);
    expect(allocationPreviewResponse.safeParse(body).success).toBe(true);
    expect(body).toMatchObject({
      loanStatus: "DRAFT",
      deferred: true,
      isRecovery: false,
      allocations: [],
      outstandingBeforeCents: null,
      outstandingAfterCents: null,
      paysOff: false,
    });
  });

  it("C16 (A13): a WRITTEN_OFF loan answers 200 as recovery and never pays the loan off", async () => {
    await seedLoan(LOAN, "2026-0001", "WRITTEN_OFF");
    await seedSchedule();
    const { status, body } = await expectNothingWritten(() => previewOf(100000));
    expect(status).toBe(200);
    expect(allocationPreviewResponse.safeParse(body).success).toBe(true);
    expect(body).toMatchObject({ loanStatus: "WRITTEN_OFF", deferred: false, isRecovery: true, paysOff: false });
    expect(body.allocations?.[0]?.installmentNumber).toBe(1);
  });

  it("C16 (A6, A13): clearing the whole balance of a written-off loan keeps paysOff false", async () => {
    await seedLoan(LOAN, "2026-0001", "WRITTEN_OFF");
    await seedSchedule();
    const { status, body } = await previewOf(613500);
    expect(status).toBe(200);
    expect(body.outstandingAfterCents).toBe(0);
    expect(body.paysOff).toBe(false);
  });
});
