import type { PGlite } from "@electric-sql/pglite";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { installmentPaidV1, loanPaidOffV1, paymentConfirmedV1, paymentResponse } from "@pilla/schemas";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { type AdminAgent, loginAsAdmin } from "../../core/http/test-admin-agent";
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

async function seedLoan(id: string, number: string, status: string, origin: string | null = null): Promise<void> {
  const settled = status === "DRAFT" || status === "CANCELLED";
  await client.query(
    `insert into lending.loans
       (id, loan_number, person_id, type, status, principal_cents, monthly_interest_rate_bps, installment_count,
        frequency_unit, frequency_interval, first_due_date, contracted_at, disbursed_at, account_id,
        origin_loan_id, origin_type, late_fee_bps, late_interest_monthly_bps, grace_period_days, rounding_step_cents,
        status_changed_at)
     values ($1, $2, $3, 'INSTALLMENT', $4, 500000, 633, 5, 'MONTH', 1, '2026-09-20', '2026-08-15',
        $5, $6, $7, $8, 250, 120, 0, 500, '2026-08-20T12:00:00Z')`,
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

// Cinco parcelas de 1.200,00 (principal 1.000,00 e juros 200,00): saldo de 6.135,00 em 20/11 (multa e mora até lá).
// Devolve o id de cada parcela, na ordem do número.
async function seedSchedule(): Promise<string[]> {
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
  return ids;
}

type Seeded = { readonly status?: string; readonly paidAt?: string; readonly version?: number };

async function seedPayment(amountCents: number, seeded: Seeded = {}): Promise<string> {
  const id = nextId();
  await client.query(
    `insert into payments.payments
       (id, loan_id, person_id, account_id, paid_at, amount_cents, method, channel, status, created_by, version)
     values ($1, $2, $3, $4, $5, $6, 'PIX', 'ADMIN', $7, $8, $9)`,
    [
      id,
      LOAN,
      PERSON,
      ACCOUNT,
      seeded.paidAt ?? "2026-11-20",
      amountCents,
      seeded.status ?? "PENDING_REVIEW",
      USER,
      seeded.version ?? 1,
    ],
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
  isRecovery?: boolean;
  confirmedAt?: string | null;
  loanStatus?: string;
  allocations?: Allocation[];
  outstandingCents?: number;
  paidCents?: number;
  installments?: { number: number; paidCents: number }[];
  amountCents?: number;
  code?: string;
  successorLoanId?: string;
  errors?: { field: string }[];
};
type Result = { status: number; body: Body };

async function confirm(id: string, version: string | number | null = 1): Promise<Result> {
  const call = admin.post(`/api/v1/payments/${id}/confirm`);
  const res = await (version === null ? call : call.set("If-Match", String(version))).send({});
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

// A recusa não grava nada (A20): as quatro tabelas ficam como estavam e o pagamento continua PENDING_REVIEW.
async function expectRefused(id: string, call: () => Promise<Result>): Promise<Result> {
  const before = await countRows();
  const result = await call();
  expect(await countRows()).toEqual(before);
  const row = await client.query<{ status: string; version: number }>(
    "select status, version from payments.payments where id = $1",
    [id],
  );
  expect(row.rows[0]).toMatchObject({ status: "PENDING_REVIEW", version: 1 });
  return result;
}

async function loanDetail(): Promise<Body> {
  const res = await admin.get(`/api/v1/loans/${LOAN}`);
  return res.body as Body;
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

type AllocationRow = {
  installment_id: string;
  late_charges_cents: number;
  interest_cents: number;
  principal_cents: number;
  reversed_at: Date | null;
};

async function allocationRows(paymentId: string): Promise<AllocationRow[]> {
  const result = await client.query<AllocationRow>(
    `select installment_id, late_charges_cents, interest_cents, principal_cents, reversed_at
       from payments.payment_allocations where payment_id = $1 order by installment_id`,
    [paymentId],
  );
  return result.rows;
}

describe("POST /api/v1/payments/{id}/confirm: allocation (E11-F03, A1 to A5)", () => {
  it("C1 (A1, A2): confirms with one allocation row per touched installment and bumps the payment", async () => {
    await seedLoan(LOAN, "2026-0001", "ACTIVE");
    const installments = await seedSchedule();
    const id = await seedPayment(126000);
    const { status, body } = await confirm(id);
    expect(status).toBe(200);
    expect(paymentResponse.safeParse(body).success).toBe(true);
    expect(body).toMatchObject({ id, status: "CONFIRMED", version: 2, isRecovery: false, loanStatus: "ACTIVE" });
    expect(body.confirmedAt).toEqual(expect.any(String));
    expect(body.allocations).toEqual([
      { installmentNumber: 1, lateChargesCents: 6000, interestCents: 20000, principalCents: 100000 },
    ]);
    const rows = await allocationRows(id);
    expect(rows).toEqual([
      {
        installment_id: installments[0],
        late_charges_cents: 6000,
        interest_cents: 20000,
        principal_cents: 100000,
        reversed_at: null,
      },
    ]);
    const stored = await client.query<{ status: string; version: number; confirmed_at: Date; confirmed_by: string }>(
      "select status, version, confirmed_at, confirmed_by from payments.payments where id = $1",
      [id],
    );
    expect(stored.rows[0]).toMatchObject({ status: "CONFIRMED", version: 2 });
    const listed = await admin.get("/api/v1/payments?status=CONFIRMED");
    expect((listed.body as { items: { id: string; version: number }[] }).items).toEqual([
      expect.objectContaining({ id, version: 2 }),
    ]);
    expect(stored.rows[0]?.confirmed_at).toBeInstanceOf(Date);
    expect(stored.rows[0]?.confirmed_by).toEqual(expect.any(String));
  });

  it("C2 (A1, A4): a payment that spills over installments writes one row per installment and they add up", async () => {
    await seedLoan(LOAN, "2026-0001", "ACTIVE");
    const installments = await seedSchedule();
    const id = await seedPayment(150000);
    const { status, body } = await confirm(id);
    expect(status).toBe(200);
    expect(body.allocations).toEqual([
      { installmentNumber: 1, lateChargesCents: 6000, interestCents: 20000, principalCents: 100000 },
      { installmentNumber: 2, lateChargesCents: 4500, interestCents: 19500, principalCents: 0 },
    ]);
    const rows = await allocationRows(id);
    expect(rows.map((row) => row.installment_id).sort()).toEqual([installments[0], installments[1]].sort());
    const total = rows.reduce((sum, row) => sum + row.late_charges_cents + row.interest_cents + row.principal_cents, 0);
    expect(total).toBe(150000);
  });

  it("C3 (A1): a payment smaller than the installment goes to the charges first and leaves the loan ACTIVE", async () => {
    await seedLoan(LOAN, "2026-0001", "ACTIVE");
    await seedSchedule();
    const id = await seedPayment(5000);
    const { status, body } = await confirm(id);
    expect(status).toBe(200);
    expect(body.allocations).toEqual([
      { installmentNumber: 1, lateChargesCents: 5000, interestCents: 0, principalCents: 0 },
    ]);
    expect(body.loanStatus).toBe("ACTIVE");
  });

  it("C4 (A5): the confirmed distribution is the same as the preview for the same state of the loan", async () => {
    await seedLoan(LOAN, "2026-0001", "ACTIVE");
    await seedSchedule();
    const id = await seedPayment(150000);
    const preview = await admin
      .post("/api/v1/payments/allocation-preview")
      .send({ loanId: LOAN, amountCents: 150000, paidAt: "2026-11-20" });
    const previewed = (preview.body as { allocations: (Allocation & { dueDate: string })[] }).allocations.map(
      ({ installmentNumber, lateChargesCents, interestCents, principalCents }) => ({
        installmentNumber,
        lateChargesCents,
        interestCents,
        principalCents,
      }),
    );
    const { body } = await confirm(id);
    expect(body.allocations).toEqual(previewed);
  });

  it("C5 (A3): GET /loans/{id} shows the installment paidCents and the lower outstandingCents (RN-R01)", async () => {
    await seedLoan(LOAN, "2026-0001", "ACTIVE");
    await seedSchedule();
    const id = await seedPayment(126000);
    const before = await loanDetail();
    expect(before.outstandingCents).toBe(613500);
    expect(before.paidCents).toBe(0);
    await confirm(id);
    const after = await loanDetail();
    expect(after.outstandingCents).toBe(487500);
    expect(after.paidCents).toBe(126000);
    expect(after.installments?.[0]).toMatchObject({ number: 1, paidCents: 126000 });
  });

  it("C6 (A5): the second confirmation distributes over what the first one left open", async () => {
    await seedLoan(LOAN, "2026-0001", "ACTIVE");
    await seedSchedule();
    const first = await seedPayment(126000);
    const second = await seedPayment(150000);
    await confirm(first);
    const { status, body } = await confirm(second);
    expect(status).toBe(200);
    expect(body.allocations?.[0]).toMatchObject({ installmentNumber: 2 });
    const total = (body.allocations ?? []).reduce(
      (sum, item) => sum + (item.lateChargesCents ?? 0) + (item.interestCents ?? 0) + (item.principalCents ?? 0),
      0,
    );
    expect(total).toBe(150000);
  });

  it("C7 (A5): the distribution is at paidAt of the payment, not at the day of the confirmation", async () => {
    await seedLoan(LOAN, "2026-0001", "ACTIVE");
    await seedSchedule();
    const id = await seedPayment(50000, { paidAt: "2026-09-10" });
    const { status, body } = await confirm(id);
    expect(status).toBe(200);
    expect(body.allocations).toEqual([
      { installmentNumber: 1, lateChargesCents: 0, interestCents: 20000, principalCents: 30000 },
    ]);
  });
});

describe("POST /api/v1/payments/{id}/confirm: events and audit (E11-F03, A6 to A8)", () => {
  it("C8 (A6): writes one PaymentConfirmed that validates against paymentConfirmedV1", async () => {
    await seedLoan(LOAN, "2026-0001", "ACTIVE");
    const installments = await seedSchedule();
    const id = await seedPayment(150000);
    await confirm(id);
    const events = await outboxOf("PaymentConfirmed");
    expect(events).toHaveLength(1);
    const event = events[0];
    const parsed = paymentConfirmedV1.safeParse(event === undefined ? null : asEvent(event));
    expect(parsed.success).toBe(true);
    expect(event?.aggregate_id).toBe(id);
    expect(event?.payload).toEqual({
      paymentId: id,
      loanId: LOAN,
      personId: PERSON,
      accountId: ACCOUNT,
      paidAt: "2026-11-20",
      amountCents: 150000,
      isRecovery: false,
      allocations: [
        { installmentId: installments[0], lateChargesCents: 6000, interestCents: 20000, principalCents: 100000 },
        { installmentId: installments[1], lateChargesCents: 4500, interestCents: 19500, principalCents: 0 },
      ],
    });
  });

  it("C9 (A7): writes one InstallmentPaid per installment that became PAID, with daysLate", async () => {
    await seedLoan(LOAN, "2026-0001", "ACTIVE");
    const installments = await seedSchedule();
    // 1.500,00 quita só a parcela 1 (61 dias de atraso); a parcela 2 recebe a sobra e fica PARTIAL.
    await confirm(await seedPayment(150000));
    const events = await outboxOf("InstallmentPaid");
    expect(events).toHaveLength(1);
    const event = events[0];
    expect(installmentPaidV1.safeParse(event === undefined ? null : asEvent(event)).success).toBe(true);
    expect(event?.payload).toEqual({
      installmentId: installments[0],
      loanId: LOAN,
      paidAt: "2026-11-20",
      daysLate: 61,
    });
  });

  it("C9 (A7): an installment paid before the due date has daysLate 0 and a partial payment emits none", async () => {
    await seedLoan(LOAN, "2026-0001", "ACTIVE");
    const installments = await seedSchedule();
    await confirm(await seedPayment(120000, { paidAt: "2026-09-10" }));
    const paid = await outboxOf("InstallmentPaid");
    expect(paid.map((row) => row.payload)).toEqual([
      { installmentId: installments[0], loanId: LOAN, paidAt: "2026-09-10", daysLate: 0 },
    ]);
    await confirm(await seedPayment(5000));
    expect(await outboxOf("InstallmentPaid")).toHaveLength(1);
  });

  it("C10 (A8): writes the audit row of the confirmation with the before and after status", async () => {
    await seedLoan(LOAN, "2026-0001", "ACTIVE");
    await seedSchedule();
    const id = await seedPayment(126000);
    await confirm(id);
    const audit = await client.query<{
      action: string;
      entity_type: string;
      entity_id: string;
      before: { status?: string };
      after: { status?: string; version?: number };
    }>("select action, entity_type, entity_id, before, after from core.audit_log where entity_type = 'payment'");
    expect(audit.rows).toHaveLength(1);
    expect(audit.rows[0]).toMatchObject({
      action: "payment.confirmed",
      entity_id: id,
      before: { status: "PENDING_REVIEW", version: 1 },
      after: { status: "CONFIRMED", version: 2 },
    });
  });

  it("C11 (A6 to A8): a failure while writing the event leaves no row at all (one transaction)", async () => {
    await seedLoan(LOAN, "2026-0001", "ACTIVE");
    await seedSchedule();
    const id = await seedPayment(126000);
    const before = await countRows();
    const failing = vi.spyOn(outboxWriter, "writeOutboxEvent").mockRejectedValue(new Error("falha simulada"));
    const { status } = await confirm(id);
    expect(status).toBe(500);
    expect(failing).toHaveBeenCalled();
    expect(await countRows()).toEqual(before);
    const row = await client.query<{ status: string; version: number; confirmed_at: Date | null }>(
      "select status, version, confirmed_at from payments.payments where id = $1",
      [id],
    );
    expect(row.rows[0]).toEqual({ status: "PENDING_REVIEW", version: 1, confirmed_at: null });
  });
});

describe("POST /api/v1/payments/{id}/confirm: PAID_OFF (E11-F03, A9 to A11)", () => {
  async function loanRow(): Promise<{ status: string; version: number; changed: boolean }> {
    const result = await client.query<{ status: string; version: number; changed: boolean }>(
      "select status, version, status_changed_at > '2026-08-20T12:00:00Z' as changed from lending.loans where id = $1",
      [LOAN],
    );
    const row = result.rows[0];
    if (row === undefined) throw new Error("loan not found");
    return row;
  }

  it("C12 (A9): clearing the balance turns ACTIVE into PAID_OFF with status_changed_at and an audit row", async () => {
    await seedLoan(LOAN, "2026-0001", "ACTIVE");
    await seedSchedule();
    const id = await seedPayment(613500);
    const { status, body } = await confirm(id);
    expect(status).toBe(200);
    expect(body.loanStatus).toBe("PAID_OFF");
    expect(await loanRow()).toMatchObject({ status: "PAID_OFF", changed: true });
    const audit = await client.query<{ action: string; entity_id: string }>(
      "select action, entity_id from core.audit_log where entity_type = 'loan'",
    );
    expect(audit.rows).toEqual([{ action: "loan.paid_off", entity_id: LOAN }]);
    expect((await loanDetail()).outstandingCents).toBe(0);
  });

  it("C12 (A9): writes one LoanPaidOff with paidOffAt = paidAt of the payment", async () => {
    await seedLoan(LOAN, "2026-0001", "ACTIVE");
    await seedSchedule();
    // Em 19/11 a parcela 4 (vence 20/11) e a 5 ainda não têm encargos: o saldo é outro.
    const quote = await admin.get(`/api/v1/loans/${LOAN}/payoff-quote?date=2026-11-19`);
    const amount = (quote.body as { amountCents: number }).amountCents;
    await confirm(await seedPayment(amount, { paidAt: "2026-11-19" }));
    const events = await outboxOf("LoanPaidOff");
    expect(events).toHaveLength(1);
    const event = events[0];
    expect(loanPaidOffV1.safeParse(event === undefined ? null : asEvent(event)).success).toBe(true);
    expect(event?.payload).toEqual({ loanId: LOAN, personId: PERSON, paidOffAt: "2026-11-19" });
  });

  it("C13 (A10): a partial payment keeps the loan ACTIVE with no LoanPaidOff", async () => {
    await seedLoan(LOAN, "2026-0001", "ACTIVE");
    await seedSchedule();
    const { body } = await confirm(await seedPayment(126000));
    expect(body.loanStatus).toBe("ACTIVE");
    expect(await loanRow()).toMatchObject({ status: "ACTIVE", version: 1, changed: false });
    expect(await outboxOf("LoanPaidOff")).toHaveLength(0);
  });

  it("C14 (A11): a payment equal to the payoff quote of the date pays the loan off", async () => {
    await seedLoan(LOAN, "2026-0001", "ACTIVE");
    await seedSchedule();
    const quote = await admin.get(`/api/v1/loans/${LOAN}/payoff-quote?date=2026-11-20`);
    const amount = (quote.body as { amountCents: number }).amountCents;
    expect(amount).toBe(613500);
    const { body } = await confirm(await seedPayment(amount));
    expect(body.loanStatus).toBe("PAID_OFF");
  });
});

describe("POST /api/v1/payments/{id}/confirm: DRAFT loan (E11-F03, A12, A13)", () => {
  it("C15 (A12): a payment of a DRAFT loan answers 409 LOAN_NOT_ACTIVE and stays PENDING_REVIEW", async () => {
    await seedLoan(LOAN, "2026-0001", "DRAFT");
    const id = await seedPayment(10000);
    const { status, body } = await expectRefused(id, () => confirm(id));
    expect(status).toBe(409);
    expect(body.code).toBe("LOAN_NOT_ACTIVE");
  });

  it("C16 (A13): after the loan is activated the same payment confirms and allocates then", async () => {
    await seedLoan(LOAN, "2026-0001", "DRAFT");
    const id = await seedPayment(10000);
    expect((await confirm(id)).status).toBe(409);
    const activated = await admin
      .post(`/api/v1/loans/${LOAN}/activate`)
      .set("If-Match", "1")
      .send({ disbursedAt: "2026-08-20", accountId: ACCOUNT });
    expect(activated.status).toBe(200);
    const { status, body } = await confirm(id);
    expect(status).toBe(200);
    expect(body).toMatchObject({ status: "CONFIRMED", loanStatus: "ACTIVE", version: 2 });
    const total = (body.allocations ?? []).reduce(
      (sum, item) => sum + (item.lateChargesCents ?? 0) + (item.interestCents ?? 0) + (item.principalCents ?? 0),
      0,
    );
    expect(total).toBe(10000);
    expect((await allocationRows(id)).length).toBeGreaterThan(0);
  });
});

describe("POST /api/v1/payments/{id}/confirm: recovery (E11-F03, A14)", () => {
  it("C17 (A14): on a WRITTEN_OFF loan sets isRecovery, allocates and keeps the loan written off", async () => {
    await seedLoan(LOAN, "2026-0001", "WRITTEN_OFF");
    await seedSchedule();
    const id = await seedPayment(613500);
    const { status, body } = await confirm(id);
    expect(status).toBe(200);
    expect(body).toMatchObject({ status: "CONFIRMED", isRecovery: true, loanStatus: "WRITTEN_OFF" });
    expect(await allocationRows(id)).toHaveLength(5);
    const stored = await client.query<{ is_recovery: boolean }>(
      "select is_recovery from payments.payments where id = $1",
      [id],
    );
    expect(stored.rows[0]?.is_recovery).toBe(true);
    const loan = await client.query<{ status: string }>("select status from lending.loans where id = $1", [LOAN]);
    expect(loan.rows[0]?.status).toBe("WRITTEN_OFF");
    expect(await outboxOf("LoanPaidOff")).toHaveLength(0);
    const confirmed = await outboxOf("PaymentConfirmed");
    expect(confirmed.map((row) => (row.payload as { isRecovery: boolean }).isRecovery)).toEqual([true]);
  });
});

describe("POST /api/v1/payments/{id}/confirm: refusals (E11-F03, A15 to A20)", () => {
  it.each(["CONFIRMED", "REVERSED"])("C18 (A15): a %s payment answers 409 PAYMENT_NOT_PENDING", async (state) => {
    await seedLoan(LOAN, "2026-0001", "ACTIVE");
    await seedSchedule();
    const id = await seedPayment(126000, { status: state });
    const before = await countRows();
    const { status, body } = await confirm(id);
    expect(status).toBe(409);
    expect(body.code).toBe("PAYMENT_NOT_PENDING");
    expect(await countRows()).toEqual(before);
  });

  it("C18 (A15): confirming twice answers 409 PAYMENT_NOT_PENDING the second time and allocates once", async () => {
    await seedLoan(LOAN, "2026-0001", "ACTIVE");
    await seedSchedule();
    const id = await seedPayment(126000);
    expect((await confirm(id)).status).toBe(200);
    const again = await confirm(id, 2);
    expect(again.status).toBe(409);
    expect(again.body.code).toBe("PAYMENT_NOT_PENDING");
    expect(await allocationRows(id)).toHaveLength(1);
  });

  it.each([2, "abc", null])("C19 (A16): If-Match %s answers 409 VERSION_CONFLICT", async (version) => {
    await seedLoan(LOAN, "2026-0001", "ACTIVE");
    await seedSchedule();
    const id = await seedPayment(126000);
    const { status, body } = await expectRefused(id, () => confirm(id, version));
    expect(status).toBe(409);
    expect(body.code).toBe("VERSION_CONFLICT");
  });

  it('C19 (A16): accepts If-Match with quotes ("1")', async () => {
    await seedLoan(LOAN, "2026-0001", "ACTIVE");
    await seedSchedule();
    const { status } = await confirm(await seedPayment(126000), '"1"');
    expect(status).toBe(200);
  });

  it("C20 (A17): an amount above the balance now answers 422 PAYMENT_EXCEEDS_BALANCE", async () => {
    await seedLoan(LOAN, "2026-0001", "ACTIVE");
    await seedSchedule();
    const first = await seedPayment(400000);
    const second = await seedPayment(400000);
    expect((await confirm(first)).status).toBe(200);
    const { status, body } = await expectRefused(second, () => confirm(second));
    expect(status).toBe(422);
    expect(body.code).toBe("PAYMENT_EXCEEDS_BALANCE");
  });

  it("C21 (A18): a loan closed meanwhile answers 422 LOAN_CLOSED_FOR_PAYMENTS with the successor", async () => {
    await seedLoan(LOAN, "2026-0001", "RENEWED");
    await seedLoan(SUCCESSOR, "2026-0002", "DRAFT", LOAN);
    await seedSchedule();
    const id = await seedPayment(126000);
    const { status, body } = await expectRefused(id, () => confirm(id));
    expect(status).toBe(422);
    expect(body).toMatchObject({ code: "LOAN_CLOSED_FOR_PAYMENTS", successorLoanId: SUCCESSOR });
  });

  it("C21 (A18): a PAID_OFF loan answers 422 LOAN_CLOSED_FOR_PAYMENTS", async () => {
    await seedLoan(LOAN, "2026-0001", "PAID_OFF");
    await seedSchedule();
    const id = await seedPayment(126000);
    const { status, body } = await expectRefused(id, () => confirm(id));
    expect(status).toBe(422);
    expect(body.code).toBe("LOAN_CLOSED_FOR_PAYMENTS");
  });

  it("C22 (A19): paidAt before the disbursement answers 400 VALIDATION_FAILED on paidAt", async () => {
    await seedLoan(LOAN, "2026-0001", "ACTIVE");
    await seedSchedule();
    const id = await seedPayment(126000, { paidAt: "2026-08-10" });
    const { status, body } = await expectRefused(id, () => confirm(id));
    expect(status).toBe(400);
    expect(body.code).toBe("VALIDATION_FAILED");
    expect(body.errors?.map((error) => error.field)).toEqual(["paidAt"]);
  });

  it("C23: a paidAt in the future answers 400 VALIDATION_FAILED on paidAt", async () => {
    await seedLoan(LOAN, "2026-0001", "ACTIVE");
    await seedSchedule();
    const id = await seedPayment(126000, { paidAt: "2026-11-25" });
    const { status, body } = await expectRefused(id, () => confirm(id));
    expect(status).toBe(400);
    expect(body.errors?.map((error) => error.field)).toEqual(["paidAt"]);
  });

  it("C24: an unknown payment answers 404 NOT_FOUND and writes nothing", async () => {
    await seedLoan(LOAN, "2026-0001", "ACTIVE");
    const before = await countRows();
    const { status, body } = await confirm(uuid(999));
    expect(status).toBe(404);
    expect(body.code).toBe("NOT_FOUND");
    expect(await countRows()).toEqual(before);
  });

  it("C24: an id that is not a UUID answers 400 VALIDATION_FAILED", async () => {
    const { status, body } = await confirm("x");
    expect(status).toBe(400);
    expect(body.code).toBe("VALIDATION_FAILED");
  });

  it("C24: a body with any key answers 400 VALIDATION_FAILED and writes nothing", async () => {
    await seedLoan(LOAN, "2026-0001", "ACTIVE");
    await seedSchedule();
    const id = await seedPayment(126000);
    const res = await admin.post(`/api/v1/payments/${id}/confirm`).set("If-Match", "1").send({ amountCents: 1 });
    expect(res.status).toBe(400);
    expect((res.body as Body).code).toBe("VALIDATION_FAILED");
    expect((await countRows())["payments.payment_allocations"]).toBe(0);
  });

  it("C24: a request with no body at all is accepted", async () => {
    await seedLoan(LOAN, "2026-0001", "ACTIVE");
    await seedSchedule();
    const id = await seedPayment(126000);
    const res = await admin.post(`/api/v1/payments/${id}/confirm`).set("If-Match", "1");
    expect(res.status).toBe(200);
  });
});
