import type { PGlite } from "@electric-sql/pglite";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { paymentResponse } from "@pilla/schemas";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { type AdminAgent, loginAsAdmin } from "../../core/http/test-admin-agent";
import { AppModule } from "../../app.module";
import { configureApp } from "../../core/http/configure-app";
import type { ApiEnv } from "../../core/http/env";
import { DATABASE_HANDLE } from "../../db/database";
import { migratedTestDb, type MigratedTestDb } from "../../db/test-db";
import { listPendingReviewPayments } from "../public/pending-payments";

const env: ApiEnv = { host: "127.0.0.1", port: 3000, databaseUrl: "postgres://u:p@127.0.0.1:1/pilla" };
const uuid = (n: number): string => `01970000-0000-7000-8000-${String(1000000000000 + n).slice(1)}`;
const PERSON = uuid(1);
const ACCOUNT = uuid(3);
const USER = uuid(4);
const LOAN = uuid(11);
const REASON = "valor digitado errado";
let counter = 100;
const nextId = (): string => uuid(++counter);

let handle: MigratedTestDb;
let client: PGlite;
let admin: AdminAgent;
let app: INestApplication;
let baseUrl: string;

beforeAll(async () => {
  handle = await migratedTestDb();
  client = handle.client;
  const moduleRef = await Test.createTestingModule({ imports: [AppModule.forRoot(env, { outboxPoller: false })] })
    .overrideProvider(DATABASE_HANDLE)
    .useValue({ db: handle.db, close: () => Promise.resolve() })
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
  await handle.close();
});
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-21T15:00:00Z"));
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
  const draft = status === "DRAFT";
  await client.query(
    `insert into lending.loans
       (id, loan_number, person_id, type, status, principal_cents, monthly_interest_rate_bps, installment_count,
        frequency_unit, frequency_interval, first_due_date, contracted_at, disbursed_at, account_id,
        late_fee_bps, late_interest_monthly_bps, grace_period_days, rounding_step_cents)
     values ($1, '2026-0001', $2, 'INSTALLMENT', $3, 500000, 633, 5, 'MONTH', 1, '2026-09-20', '2026-08-15',
        $4, $5, 250, 120, 0, 500)`,
    [LOAN, PERSON, status, draft ? null : "2026-08-20", draft ? null : ACCOUNT],
  );
  for (const [index, dueDate] of ["2026-09-20", "2026-10-20", "2026-11-19", "2026-11-20", "2026-12-20"].entries()) {
    await client.query(
      `insert into lending.installments (id, loan_id, number, due_date, principal_cents, interest_cents, total_cents)
       values ($1, $2, $3, $4, 100000, 20000, 120000)`,
      [nextId(), LOAN, index + 1, dueDate],
    );
  }
}

async function seedPayment(status = "PENDING_REVIEW", amountCents = 100000): Promise<string> {
  const id = nextId();
  await client.query(
    `insert into payments.payments
       (id, loan_id, person_id, account_id, paid_at, amount_cents, method, channel, status, created_by)
     values ($1, $2, $3, $4, '2026-11-20', $5, 'PIX', 'ADMIN', $6, $7)`,
    [id, LOAN, PERSON, ACCOUNT, amountCents, status, USER],
  );
  return id;
}

type Body = {
  id?: string;
  status?: string;
  version?: number;
  loanStatus?: string;
  allocations?: unknown[];
  paidCents?: number;
  outstandingCents?: number;
  code?: string;
  errors?: { field: string }[];
};
type Result = { status: number; body: Body };

const MISSING = Symbol("missing reason");

async function reject(id: string, reason: unknown = REASON, version: string | number | null = 1): Promise<Result> {
  const call = admin.post(`/api/v1/payments/${id}/reject`);
  const res = await (version === null ? call : call.set("If-Match", String(version))).send(
    reason === MISSING ? {} : { reason },
  );
  return { status: res.status, body: res.body as Body };
}

async function reverse(id: string): Promise<Result> {
  const res = await admin.post(`/api/v1/payments/${id}/reverse`).set("If-Match", "1").send({ reason: "x" });
  return { status: res.status, body: res.body as Body };
}

async function confirm(id: string): Promise<Result> {
  const res = await admin.post(`/api/v1/payments/${id}/confirm`).set("If-Match", "1").send({});
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

// Recusa grava nada: as quatro tabelas e a linha do pagamento ficam como estavam.
async function expectNothingWritten(id: string, call: () => Promise<Result>): Promise<Result> {
  const before = await countRows();
  const rowBefore = await client.query("select * from payments.payments where id = $1", [id]);
  const result = await call();
  expect(await countRows()).toEqual(before);
  expect((await client.query("select * from payments.payments where id = $1", [id])).rows).toEqual(rowBefore.rows);
  return result;
}

async function loanDetail(): Promise<{
  paidCents: number | undefined;
  outstandingCents: number | undefined;
  status: string | undefined;
}> {
  const res = await admin.get(`/api/v1/loans/${LOAN}`);
  const body = res.body as Body;
  return { paidCents: body.paidCents, outstandingCents: body.outstandingCents, status: body.status };
}

describe("POST /api/v1/payments/{id}/reject: rejection (E11-F04, A1 to A3)", () => {
  it("C1 (A1): answers 200 paymentResponse REJECTED, version + 1, with no allocation", async () => {
    await seedLoan("ACTIVE");
    const id = await seedPayment();
    const { status, body } = await reject(id);
    expect(status).toBe(200);
    expect(paymentResponse.safeParse(body).success).toBe(true);
    expect(body).toMatchObject({ id, status: "REJECTED", version: 2, loanStatus: "ACTIVE", allocations: [] });
  });

  it("C2 (A1): stores rejected_at, rejected_by, rejection_reason and version + 1", async () => {
    await seedLoan("ACTIVE");
    const id = await seedPayment();
    await reject(id, `  ${REASON}  `);
    const rows = await client.query<Record<string, unknown>>(
      "select status, version, rejected_at, rejected_by, rejection_reason, confirmed_at, reversed_at from payments.payments where id = $1",
      [id],
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0]).toMatchObject({
      status: "REJECTED",
      version: 2,
      rejection_reason: REASON,
      confirmed_at: null,
      reversed_at: null,
    });
    expect(rows.rows[0]?.rejected_at).toEqual(new Date("2026-11-21T15:00:00Z"));
    expect(rows.rows[0]?.rejected_by).toEqual(expect.any(String));
  });

  it("C3 (A2): writes one audit row with the reason, in the same transaction", async () => {
    await seedLoan("ACTIVE");
    const id = await seedPayment();
    await reject(id);
    const audit = await client.query<{ action: string; entity_type: string; entity_id: string; after: unknown }>(
      "select action, entity_type, entity_id, after from core.audit_log",
    );
    expect(audit.rows).toHaveLength(1);
    expect(audit.rows[0]).toMatchObject({ action: "payment.rejected", entity_type: "payment", entity_id: id });
    expect(JSON.stringify(audit.rows[0]?.after)).toContain(REASON);
  });

  it("C4 (A2): keeps the row (ADR-0006) and lists it in GET /payments?status=REJECTED", async () => {
    await seedLoan("ACTIVE");
    const id = await seedPayment();
    const other = await seedPayment();
    await reject(id);
    const res = await admin.get("/api/v1/payments?status=REJECTED");
    const items = (res.body as { items: { id: string; status: string }[] }).items;
    expect(res.status).toBe(200);
    expect(items.map((item) => item.id)).toEqual([id]);
    expect(items[0]?.status).toBe("REJECTED");
    expect(items.map((item) => item.id)).not.toContain(other);
    expect((await countRows())["payments.payments"]).toBe(2);
  });

  it("C5 (A2): the payment keeps the loan number and the person name in the list", async () => {
    await seedLoan("ACTIVE");
    const id = await seedPayment();
    await reject(id);
    const res = await admin.get("/api/v1/payments?status=REJECTED");
    const items = (res.body as { items: Record<string, unknown>[] }).items;
    expect(items[0]).toMatchObject({ id, loanNumber: "2026-0001", personName: "Ana Souza", amountCents: 100000 });
  });
});

describe("POST /api/v1/payments/{id}/reject: no financial effect (E11-F04, A3)", () => {
  it("C6 (A3): writes no allocation and no outbox event (RN-R01)", async () => {
    await seedLoan("ACTIVE");
    expect((await reject(await seedPayment())).status).toBe(200);
    const counts = await countRows();
    expect(counts["payments.payment_allocations"]).toBe(0);
    expect(counts["core.outbox"]).toBe(0);
  });

  it("C7 (A3): the loan paidCents, outstandingCents and status stay identical", async () => {
    await seedLoan("ACTIVE");
    const id = await seedPayment();
    const before = await loanDetail();
    expect((await reject(id)).status).toBe(200);
    expect(await loanDetail()).toEqual(before);
    expect(before.status).toBe("ACTIVE");
  });

  it("C8 (A3): a DRAFT loan keeps its status and its figures", async () => {
    await seedLoan("DRAFT");
    const id = await seedPayment();
    const before = await loanDetail();
    const { status, body } = await reject(id);
    expect(status).toBe(200);
    expect(body.loanStatus).toBe("DRAFT");
    expect(await loanDetail()).toEqual(before);
    expect(before.status).toBe("DRAFT");
  });
});

describe("POST /api/v1/payments/{id}/reject: review queue (E11-F04, A4)", () => {
  it("C9 (A4): leaves listPendingReviewPayments (count and totalCents drop) and cannot be confirmed", async () => {
    await seedLoan("ACTIVE");
    const kept = await seedPayment("PENDING_REVIEW", 30000);
    const dropped = await seedPayment("PENDING_REVIEW", 70000);
    const before = await listPendingReviewPayments(handle.db);
    expect([before.count, before.totalCents]).toEqual([2, 100000]);
    await reject(dropped);
    const after = await listPendingReviewPayments(handle.db);
    expect([after.count, after.totalCents]).toEqual([1, 30000]);
    expect(after.items.map((item) => item.id)).toEqual([kept]);
    const late = await confirm(dropped);
    expect(late.status).toBe(409);
    expect(late.body.code).toBe("PAYMENT_NOT_PENDING");
  });
});

describe("POST /api/v1/payments/{id}/reject: refusals (E11-F04, A5, A6)", () => {
  it.each(["CONFIRMED", "REVERSED", "REJECTED"])(
    "C10 (A5): a %s payment answers 409 PAYMENT_NOT_PENDING and writes nothing",
    async (current) => {
      await seedLoan("ACTIVE");
      const id = await seedPayment(current);
      const { status, body } = await expectNothingWritten(id, () => reject(id));
      expect(status).toBe(409);
      expect(body.code).toBe("PAYMENT_NOT_PENDING");
    },
  );

  it("C11 (A5): rejecting twice answers 409 PAYMENT_NOT_PENDING the second time, with one audit row", async () => {
    await seedLoan("ACTIVE");
    const id = await seedPayment();
    expect((await reject(id)).status).toBe(200);
    const second = await reject(id, REASON, 2);
    expect(second.status).toBe(409);
    expect(second.body.code).toBe("PAYMENT_NOT_PENDING");
    expect((await countRows())["core.audit_log"]).toBe(1);
  });

  it("C12 (A6): a wrong If-Match answers 409 VERSION_CONFLICT and writes nothing", async () => {
    await seedLoan("ACTIVE");
    const id = await seedPayment();
    const { status, body } = await expectNothingWritten(id, () => reject(id, REASON, 7));
    expect(status).toBe(409);
    expect(body.code).toBe("VERSION_CONFLICT");
  });

  it.each([
    ["missing", MISSING],
    ["empty", ""],
    ["blank", "   "],
    ["not a text", 5],
    ["above 500 characters", "a".repeat(501)],
  ])("C13 (A6): a %s reason answers 400 VALIDATION_FAILED on reason and writes nothing", async (_label, reason) => {
    await seedLoan("ACTIVE");
    const id = await seedPayment();
    const { status, body } = await expectNothingWritten(id, () => reject(id, reason));
    expect(status).toBe(400);
    expect(body.code).toBe("VALIDATION_FAILED");
    expect(body.errors?.map((error) => error.field)).toEqual(["reason"]);
  });

  it("C14 (A6): a body with an unknown key answers 400 VALIDATION_FAILED and writes nothing", async () => {
    await seedLoan("ACTIVE");
    const id = await seedPayment();
    const before = await countRows();
    const res = await admin
      .post(`/api/v1/payments/${id}/reject`)
      .set("If-Match", "1")
      .send({ reason: REASON, status: "CONFIRMED" });
    expect(res.status).toBe(400);
    expect((res.body as Body).code).toBe("VALIDATION_FAILED");
    expect(await countRows()).toEqual(before);
  });

  it("C15 (A6): an unknown payment answers 404 NOT_FOUND and writes nothing", async () => {
    await seedLoan("ACTIVE");
    const before = await countRows();
    const { status, body } = await reject(uuid(97));
    expect(status).toBe(404);
    expect(body.code).toBe("NOT_FOUND");
    expect(await countRows()).toEqual(before);
  });

  it("C15 (A6): an id that is not a UUID answers 400 VALIDATION_FAILED", async () => {
    const { status, body } = await reject("x");
    expect(status).toBe(400);
    expect(body.code).toBe("VALIDATION_FAILED");
  });

  it("C16 (A5): reversing a REJECTED payment answers 409 PAYMENT_NOT_CONFIRMED and writes nothing", async () => {
    await seedLoan("ACTIVE");
    const id = await seedPayment();
    await reject(id);
    const { status, body } = await expectNothingWritten(id, () => reverse(id));
    expect(status).toBe(409);
    expect(body.code).toBe("PAYMENT_NOT_CONFIRMED");
  });
});
