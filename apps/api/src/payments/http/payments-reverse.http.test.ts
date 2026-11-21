import type { PGlite } from "@electric-sql/pglite";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { loanReopenedV1, paymentResponse, paymentReversedV1 } from "@pilla/schemas";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AppModule } from "../../app.module";
import { configureApp } from "../../core/http/configure-app";
import type { ApiEnv } from "../../core/http/env";
import * as outboxWriter from "../../core/infra/outbox-writer";
import { DATABASE_HANDLE } from "../../db/database";
import { migratedTestDb } from "../../db/test-db";

const env: ApiEnv = { host: "127.0.0.1", port: 3000, databaseUrl: "postgres://u:p@127.0.0.1:1/pilla" };
const uuid = (n: number): string => `01970000-0000-7000-8000-${String(1000000000000 + n).slice(1)}`;
const PERSON = uuid(1);
const ACCOUNT = uuid(3);
const USER = uuid(4);
const LOAN = uuid(11);
const REASON = "pagamento lançado em duplicidade";
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
  vi.useFakeTimers({ toFake: ["Date"] });
  // Hoje em Brasília: 2026-11-20.
  vi.setSystemTime(new Date("2026-11-20T15:00:00Z"));
  await client.query("delete from payments.payment_allocations");
  await client.query("delete from payments.payments");
  await client.query("delete from lending.installments");
  await client.query("delete from lending.loans");
  await client.query("delete from core.outbox");
  await client.query("delete from core.audit_log");
  await client.query("delete from treasury.accounts");
  await client.query("delete from people.persons");
  await client.query(
    "insert into people.persons (id, full_name, cpf, phone) values ($1, 'Ana Souza', '52998224725', '+5511987654321')",
    [PERSON],
  );
  await client.query("insert into treasury.accounts (id, name, active) values ($1, 'Conta ativa', true)", [ACCOUNT]);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function seedLoan(status: string): Promise<void> {
  await client.query(
    `insert into lending.loans
       (id, loan_number, person_id, type, status, principal_cents, monthly_interest_rate_bps, installment_count,
        frequency_unit, frequency_interval, first_due_date, contracted_at, disbursed_at, account_id,
        late_fee_bps, late_interest_monthly_bps, grace_period_days, rounding_step_cents, status_changed_at)
     values ($1, '2026-0001', $2, 'INSTALLMENT', $3, 500000, 633, 5, 'MONTH', 1, '2026-09-20', '2026-08-15',
        '2026-08-20', $4, 250, 120, 0, 500, '2026-08-20T12:00:00Z')`,
    [LOAN, PERSON, status, ACCOUNT],
  );
}

// Cinco parcelas de 1.200,00 (principal 1.000,00 e juros 200,00): saldo de 6.135,00 em 20/11 (multa e mora até lá).
async function seedSchedule(): Promise<string[]> {
  const ids: string[] = [];
  for (const [index, dueDate] of ["2026-09-20", "2026-10-20", "2026-11-19", "2026-11-20", "2026-12-20"].entries()) {
    const id = nextId();
    ids.push(id);
    await client.query(
      `insert into lending.installments (id, loan_id, number, due_date, principal_cents, interest_cents, total_cents)
       values ($1, $2, $3, $4, 100000, 20000, 120000)`,
      [id, LOAN, index + 1, dueDate],
    );
  }
  return ids;
}

async function seedPayment(amountCents: number, status = "PENDING_REVIEW"): Promise<string> {
  const id = nextId();
  await client.query(
    `insert into payments.payments
       (id, loan_id, person_id, account_id, paid_at, amount_cents, method, channel, status, created_by)
     values ($1, $2, $3, $4, '2026-11-20', $5, 'PIX', 'ADMIN', $6, $7)`,
    [id, LOAN, PERSON, ACCOUNT, amountCents, status, USER],
  );
  return id;
}

type Allocation = {
  installmentNumber?: number;
  lateChargesCents?: number;
  interestCents?: number;
  principalCents?: number;
};
type Body = {
  id?: string;
  status?: string;
  version?: number;
  loanStatus?: string;
  allocations?: Allocation[];
  reversedAt?: string | null;
  reversalReason?: string | null;
  outstandingCents?: number;
  paidCents?: number;
  installments?: { number: number; paidCents: number; status?: string }[];
  code?: string;
  errors?: { field: string }[];
};
type Result = { status: number; body: Body };

const MISSING = Symbol("missing reason");

async function confirm(id: string): Promise<Result> {
  const res = await request(baseUrl).post(`/api/v1/payments/${id}/confirm`).set("If-Match", "1").send({});
  return { status: res.status, body: res.body as Body };
}

// Pagamento CONFIRMED de verdade (alocações e eventos de confirmação gravados), versão 2.
async function seedConfirmed(amountCents: number): Promise<string> {
  const id = await seedPayment(amountCents);
  expect((await confirm(id)).status).toBe(200);
  return id;
}

async function reverse(
  id: string,
  reason: unknown = REASON,
  version: string | number | null = 2,
  extra: Record<string, unknown> = {},
): Promise<Result> {
  const call = request(baseUrl).post(`/api/v1/payments/${id}/reverse`);
  const res = await (version === null ? call : call.set("If-Match", String(version))).send(
    reason === MISSING ? { ...extra } : { reason, ...extra },
  );
  return { status: res.status, body: res.body as Body };
}

async function countRows(): Promise<Record<string, number>> {
  const tables = ["payments.payments", "payments.payment_allocations", "core.outbox", "core.audit_log"];
  const counts: Record<string, number> = {};
  for (const table of tables) {
    const result = await client.query<{ n: string }>(`select count(*)::text as n from ${table}`);
    counts[table] = Number(result.rows[0]?.n);
  }
  return counts;
}

// A recusa não grava nada (A17): contagens das quatro tabelas, o pagamento, as alocações e o contrato ficam iguais.
async function expectNothingWritten(id: string, call: () => Promise<Result>): Promise<Result> {
  const snapshot = async (): Promise<unknown[]> => [
    await countRows(),
    (await client.query("select * from payments.payments where id = $1", [id])).rows,
    (await client.query("select * from payments.payment_allocations order by id")).rows,
    (await client.query("select * from lending.loans where id = $1", [LOAN])).rows,
  ];
  const before = await snapshot();
  const result = await call();
  expect(await snapshot()).toEqual(before);
  return result;
}

async function loanDetail(): Promise<Body> {
  const res = await request(baseUrl).get(`/api/v1/loans/${LOAN}`);
  return res.body as Body;
}

type LoanRow = { status: string; changed: boolean };

async function loanRow(): Promise<LoanRow> {
  const result = await client.query<LoanRow>(
    "select status, status_changed_at > '2026-08-20T12:00:00Z' as changed from lending.loans where id = $1",
    [LOAN],
  );
  const row = result.rows[0];
  if (row === undefined) throw new Error("loan not found");
  return row;
}

type OutboxRow = {
  id: string;
  event_type: string;
  event_version: number;
  aggregate_id: string;
  payload: unknown;
  occurred_at: Date;
};

async function outboxOf(type: string): Promise<OutboxRow[]> {
  const result = await client.query<OutboxRow>(
    "select id, event_type, event_version, aggregate_id, payload, occurred_at from core.outbox where event_type = $1",
    [type],
  );
  return result.rows;
}

const asEvent = (row: OutboxRow): Record<string, unknown> => ({
  id: row.id,
  type: row.event_type,
  version: row.event_version,
  occurredAt: row.occurred_at.toISOString(),
  aggregateId: row.aggregate_id,
  payload: row.payload,
});

type AllocationRow = { installment_id: string; reversed_at: Date | null; total: number };

async function allocationRows(paymentId: string): Promise<AllocationRow[]> {
  const result = await client.query<AllocationRow>(
    `select installment_id, reversed_at,
            (late_charges_cents + interest_cents + principal_cents)::int as total
       from payments.payment_allocations where payment_id = $1 order by installment_id`,
    [paymentId],
  );
  return result.rows;
}

describe("POST /api/v1/payments/{id}/reverse: reversal (E11-F04, A1 to A6)", () => {
  it("C1 (A1): answers 200 paymentResponse REVERSED, version + 1, with the reason and no allocation", async () => {
    await seedLoan("ACTIVE");
    await seedSchedule();
    const id = await seedConfirmed(126000);
    const { status, body } = await reverse(id);
    expect(status).toBe(200);
    expect(paymentResponse.safeParse(body).success).toBe(true);
    expect(body).toMatchObject({
      id,
      status: "REVERSED",
      version: 3,
      reversalReason: REASON,
      loanStatus: "ACTIVE",
      allocations: [],
    });
    expect(body.reversedAt).toEqual(expect.any(String));
  });

  it("C2 (A1): stores reversed_at, reversed_by, reversal_reason (trimmed) and version + 1", async () => {
    await seedLoan("ACTIVE");
    await seedSchedule();
    const id = await seedConfirmed(126000);
    await reverse(id, `  ${REASON}  `);
    const rows = await client.query<Record<string, unknown>>(
      "select status, version, reversed_at, reversed_by, reversal_reason, confirmed_at from payments.payments where id = $1",
      [id],
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0]).toMatchObject({ status: "REVERSED", version: 3, reversal_reason: REASON });
    expect(rows.rows[0]?.reversed_at).toEqual(new Date("2026-11-20T15:00:00Z"));
    expect(rows.rows[0]?.reversed_by).toEqual(expect.any(String));
    expect(rows.rows[0]?.confirmed_at).toBeInstanceOf(Date);
  });

  it("C3 (A2): every allocation of the payment gets reversed_at and no row is deleted (RN-R07)", async () => {
    await seedLoan("ACTIVE");
    await seedSchedule();
    const id = await seedConfirmed(150000);
    const before = await allocationRows(id);
    expect(before).toHaveLength(2);
    expect((await reverse(id)).status).toBe(200);
    const after = await allocationRows(id);
    expect(after.map((row) => [row.installment_id, row.total])).toEqual(
      before.map((row) => [row.installment_id, row.total]),
    );
    expect(after.every((row) => row.reversed_at?.toISOString() === "2026-11-20T15:00:00.000Z")).toBe(true);
    expect((await countRows())["payments.payments"]).toBe(1);
  });

  it("C4 (A3): the installments and outstandingCents of GET /loans/{id} go back as if it never happened", async () => {
    await seedLoan("ACTIVE");
    await seedSchedule();
    const before = await loanDetail();
    const id = await seedConfirmed(150000);
    const confirmed = await loanDetail();
    expect(confirmed.paidCents).toBe(150000);
    expect(confirmed.outstandingCents).toBeLessThan(before.outstandingCents ?? 0);
    expect((await reverse(id)).status).toBe(200);
    const after = await loanDetail();
    expect(after.outstandingCents).toBe(613500);
    expect(after.paidCents).toBe(0);
    expect(after.installments).toEqual(before.installments);
  });

  it("C5 (A4): writes one payment audit row with the before and after status and the reason", async () => {
    await seedLoan("ACTIVE");
    await seedSchedule();
    const id = await seedConfirmed(126000);
    await client.query("delete from core.audit_log");
    await reverse(id);
    const audit = await client.query<{
      action: string;
      entity_id: string;
      before: { status?: string; version?: number };
      after: { status?: string; version?: number };
    }>("select action, entity_id, before, after from core.audit_log where entity_type = 'payment'");
    expect(audit.rows).toHaveLength(1);
    expect(audit.rows[0]).toMatchObject({
      action: "payment.reversed",
      entity_id: id,
      before: { status: "CONFIRMED", version: 2 },
      after: { status: "REVERSED", version: 3 },
    });
    expect(JSON.stringify(audit.rows[0]?.after)).toContain(REASON);
  });

  it("C6 (A5): reversing a payment that is not the last one is accepted and leaves the others as they are", async () => {
    await seedLoan("ACTIVE");
    await seedSchedule();
    const first = await seedConfirmed(126000);
    const second = await seedConfirmed(150000);
    const secondBefore = await allocationRows(second);
    const { status } = await reverse(first);
    expect(status).toBe(200);
    expect(await allocationRows(second)).toEqual(secondBefore);
    expect((await allocationRows(first)).every((row) => row.reversed_at !== null)).toBe(true);
    const stored = await client.query<{ id: string; status: string }>(
      "select id, status from payments.payments where id = $1",
      [second],
    );
    expect(stored.rows[0]).toEqual({ id: second, status: "CONFIRMED" });
    expect((await loanDetail()).paidCents).toBe(150000);
  });

  it("C7 (A6): reversing keeps an ACTIVE loan ACTIVE, with no status change and no LoanReopened", async () => {
    await seedLoan("ACTIVE");
    await seedSchedule();
    const id = await seedConfirmed(126000);
    const { body } = await reverse(id);
    expect(body.loanStatus).toBe("ACTIVE");
    expect(await loanRow()).toMatchObject({ status: "ACTIVE", changed: false });
    expect(await outboxOf("LoanReopened")).toHaveLength(0);
  });

  it("C7 (A6): reversing a recovery payment keeps a WRITTEN_OFF loan WRITTEN_OFF", async () => {
    await seedLoan("WRITTEN_OFF");
    await seedSchedule();
    const id = await seedConfirmed(126000);
    const { status, body } = await reverse(id);
    expect(status).toBe(200);
    expect(body.loanStatus).toBe("WRITTEN_OFF");
    expect(await loanRow()).toMatchObject({ status: "WRITTEN_OFF", changed: false });
    expect(await outboxOf("LoanReopened")).toHaveLength(0);
  });
});

describe("POST /api/v1/payments/{id}/reverse: events (E11-F04, A7)", () => {
  it("C8 (A7): writes one PaymentReversed that validates against paymentReversedV1, with the allocations and the reason", async () => {
    await seedLoan("ACTIVE");
    const installments = await seedSchedule();
    const id = await seedConfirmed(150000);
    await reverse(id);
    const events = await outboxOf("PaymentReversed");
    expect(events).toHaveLength(1);
    const event = events[0];
    expect(paymentReversedV1.safeParse(event === undefined ? null : asEvent(event)).success).toBe(true);
    expect(event?.aggregate_id).toBe(id);
    expect(event?.payload).toEqual({
      paymentId: id,
      loanId: LOAN,
      accountId: ACCOUNT,
      amountCents: 150000,
      allocations: [
        { installmentId: installments[0], lateChargesCents: 6000, interestCents: 20000, principalCents: 100000 },
        { installmentId: installments[1], lateChargesCents: 4500, interestCents: 19500, principalCents: 0 },
      ],
      reason: REASON,
    });
  });

  it("C9 (A7): nothing is published when the reversal is refused, and the confirmation events stay alone", async () => {
    await seedLoan("ACTIVE");
    await seedSchedule();
    const id = await seedConfirmed(126000);
    const before = (await outboxOf("PaymentConfirmed")).length;
    expect((await reverse(id, REASON, 9)).status).toBe(409);
    expect(await outboxOf("PaymentReversed")).toHaveLength(0);
    expect(await outboxOf("PaymentConfirmed")).toHaveLength(before);
  });

  it("C9 (A7): a failure while writing the event leaves no row changed (one transaction)", async () => {
    await seedLoan("ACTIVE");
    await seedSchedule();
    const id = await seedConfirmed(126000);
    const failing = vi.spyOn(outboxWriter, "writeOutboxEvent");
    failing.mockRejectedValue(new Error("falha simulada"));
    const { status } = await expectNothingWritten(id, () => reverse(id));
    expect(status).toBe(500);
    expect(failing).toHaveBeenCalled();
  });
});

describe("POST /api/v1/payments/{id}/reverse: reopening a PAID_OFF loan (E11-F04, A8 to A10)", () => {
  it("C10 (A8): reversing a payment of a PAID_OFF loan that leaves a balance sets it back to ACTIVE", async () => {
    await seedLoan("ACTIVE");
    await seedSchedule();
    const id = await seedConfirmed(613500);
    expect((await loanDetail()).status).toBe("PAID_OFF");
    expect(await loanRow()).toMatchObject({ status: "PAID_OFF", changed: true });
    await client.query("update lending.loans set status_changed_at = '2026-08-20T12:00:00Z' where id = $1", [LOAN]);
    const { status, body } = await reverse(id);
    expect(status).toBe(200);
    expect(body.loanStatus).toBe("ACTIVE");
    expect(await loanRow()).toMatchObject({ status: "ACTIVE", changed: true });
    const detail = await loanDetail();
    expect(detail.status).toBe("ACTIVE");
    expect(detail.outstandingCents).toBe(613500);
  });

  it("C10 (A8): writes an audit row of the loan with the status before and after", async () => {
    await seedLoan("ACTIVE");
    await seedSchedule();
    const id = await seedConfirmed(613500);
    await client.query("delete from core.audit_log");
    await reverse(id);
    const audit = await client.query<{
      action: string;
      entity_id: string;
      before: { status?: string };
      after: { status?: string };
    }>("select action, entity_id, before, after from core.audit_log where entity_type = 'loan'");
    expect(audit.rows).toHaveLength(1);
    expect(audit.rows[0]).toMatchObject({
      action: "loan.reopened",
      entity_id: LOAN,
      before: { status: "PAID_OFF" },
      after: { status: "ACTIVE" },
    });
  });

  it("C11 (A9): writes one LoanReopened with the reversal reason that validates against loanReopenedV1", async () => {
    await seedLoan("ACTIVE");
    await seedSchedule();
    const id = await seedConfirmed(613500);
    await reverse(id);
    const events = await outboxOf("LoanReopened");
    expect(events).toHaveLength(1);
    const event = events[0];
    expect(loanReopenedV1.safeParse(event === undefined ? null : asEvent(event)).success).toBe(true);
    expect(event?.aggregate_id).toBe(LOAN);
    expect(event?.payload).toEqual({ loanId: LOAN, reason: REASON });
    expect(await outboxOf("PaymentReversed")).toHaveLength(1);
  });

  it("C12 (A10): with no principal or interest left open after the reversal the loan stays PAID_OFF", async () => {
    // O pagamento estornado só quitou encargos (multa e mora): sem eles o saldo de principal e juros segue zero.
    await seedLoan("PAID_OFF");
    const installments = await seedSchedule();
    const principalAndInterest = await seedPayment(600000, "CONFIRMED");
    for (const installment of installments) {
      await client.query(
        `insert into payments.payment_allocations
           (id, payment_id, loan_id, installment_id, late_charges_cents, interest_cents, principal_cents)
         values ($1, $2, $3, $4, 0, 20000, 100000)`,
        [nextId(), principalAndInterest, LOAN, installment],
      );
    }
    const chargesOnly = await seedPayment(6000, "CONFIRMED");
    await client.query(
      `insert into payments.payment_allocations
         (id, payment_id, loan_id, installment_id, late_charges_cents, interest_cents, principal_cents)
       values ($1, $2, $3, $4, 6000, 0, 0)`,
      [nextId(), chargesOnly, LOAN, installments[0]],
    );
    await client.query("update payments.payments set version = 2 where id = any($1)", [
      [principalAndInterest, chargesOnly],
    ]);
    const { status, body } = await reverse(chargesOnly);
    expect(status).toBe(200);
    expect(body.loanStatus).toBe("PAID_OFF");
    expect(await loanRow()).toMatchObject({ status: "PAID_OFF", changed: false });
    expect(await outboxOf("LoanReopened")).toHaveLength(0);
    const audit = await client.query("select 1 from core.audit_log where entity_type = 'loan'");
    expect(audit.rows).toHaveLength(0);
  });
});

describe("POST /api/v1/payments/{id}/reverse: blocked by a successor (E11-F04, A11, A12)", () => {
  it.each(["RENEWED", "RENEGOTIATED"])(
    "C13 (A11, A12): a %s loan answers 422 REVERSAL_BLOCKED_BY_SUCCESSOR and writes nothing",
    async (loanStatus) => {
      await seedLoan("ACTIVE");
      await seedSchedule();
      const id = await seedConfirmed(126000);
      await client.query("update lending.loans set status = $1 where id = $2", [loanStatus, LOAN]);
      const { status, body } = await expectNothingWritten(id, () => reverse(id));
      expect(status).toBe(422);
      expect(body.code).toBe("REVERSAL_BLOCKED_BY_SUCCESSOR");
    },
  );

  it("C14 (A12): after the block the payment is still CONFIRMED with its allocations open and no event", async () => {
    await seedLoan("ACTIVE");
    await seedSchedule();
    const id = await seedConfirmed(126000);
    await client.query("update lending.loans set status = 'RENEGOTIATED' where id = $1", [LOAN]);
    await reverse(id);
    const stored = await client.query<{ status: string; version: number }>(
      "select status, version from payments.payments where id = $1",
      [id],
    );
    expect(stored.rows[0]).toEqual({ status: "CONFIRMED", version: 2 });
    expect((await allocationRows(id)).every((row) => row.reversed_at === null)).toBe(true);
    expect(await outboxOf("PaymentReversed")).toHaveLength(0);
    expect(await outboxOf("LoanReopened")).toHaveLength(0);
  });
});

describe("POST /api/v1/payments/{id}/reverse: refusals (E11-F04, A13 to A17)", () => {
  it.each(["PENDING_REVIEW", "REVERSED", "REJECTED"])(
    "C15 (A13): a %s payment answers 409 PAYMENT_NOT_CONFIRMED and writes nothing",
    async (current) => {
      await seedLoan("ACTIVE");
      await seedSchedule();
      const id = await seedPayment(126000, current);
      const { status, body } = await expectNothingWritten(id, () => reverse(id, REASON, 1));
      expect(status).toBe(409);
      expect(body.code).toBe("PAYMENT_NOT_CONFIRMED");
    },
  );

  it("C16 (A13): reversing twice answers 409 PAYMENT_NOT_CONFIRMED the second time, with one PaymentReversed", async () => {
    await seedLoan("ACTIVE");
    await seedSchedule();
    const id = await seedConfirmed(126000);
    expect((await reverse(id)).status).toBe(200);
    const second = await reverse(id, REASON, 3);
    expect(second.status).toBe(409);
    expect(second.body.code).toBe("PAYMENT_NOT_CONFIRMED");
    expect(await outboxOf("PaymentReversed")).toHaveLength(1);
  });

  it.each([1, 7, "abc", null])(
    "C17 (A14): If-Match %s answers 409 VERSION_CONFLICT and writes nothing",
    async (version) => {
      await seedLoan("ACTIVE");
      await seedSchedule();
      const id = await seedConfirmed(126000);
      const { status, body } = await expectNothingWritten(id, () => reverse(id, REASON, version));
      expect(status).toBe(409);
      expect(body.code).toBe("VERSION_CONFLICT");
    },
  );

  it.each([
    ["missing", MISSING],
    ["empty", ""],
    ["blank", "   "],
    ["not a text", 5],
    ["above 500 characters", "a".repeat(501)],
  ])("C18 (A15): a %s reason answers 400 VALIDATION_FAILED on reason and writes nothing", async (_label, reason) => {
    await seedLoan("ACTIVE");
    await seedSchedule();
    const id = await seedConfirmed(126000);
    const { status, body } = await expectNothingWritten(id, () => reverse(id, reason));
    expect(status).toBe(400);
    expect(body.code).toBe("VALIDATION_FAILED");
    expect(body.errors?.map((error) => error.field)).toEqual(["reason"]);
  });

  it("C18 (A15): a body with an unknown key answers 400 VALIDATION_FAILED and writes nothing", async () => {
    await seedLoan("ACTIVE");
    await seedSchedule();
    const id = await seedConfirmed(126000);
    const { status, body } = await expectNothingWritten(id, () => reverse(id, REASON, 2, { status: "CONFIRMED" }));
    expect(status).toBe(400);
    expect(body.code).toBe("VALIDATION_FAILED");
  });

  it("C19 (A16): an unknown payment answers 404 NOT_FOUND and writes nothing", async () => {
    await seedLoan("ACTIVE");
    const before = await countRows();
    const { status, body } = await reverse(uuid(97));
    expect(status).toBe(404);
    expect(body.code).toBe("NOT_FOUND");
    expect(await countRows()).toEqual(before);
  });

  it("C19 (A16): an id that is not a UUID answers 400 VALIDATION_FAILED", async () => {
    const { status, body } = await reverse("x");
    expect(status).toBe(400);
    expect(body.code).toBe("VALIDATION_FAILED");
  });

  it("C20 (A17): the refusals leave GET /loans/{id} identical", async () => {
    await seedLoan("ACTIVE");
    await seedSchedule();
    const id = await seedConfirmed(126000);
    const before = await loanDetail();
    expect((await reverse(id, REASON, 9)).status).toBe(409);
    expect((await reverse(id, "")).status).toBe(400);
    expect(await loanDetail()).toEqual(before);
  });
});
