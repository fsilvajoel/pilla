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
import { migratedTestDb } from "../../db/test-db";
import * as paymentRepository from "../infra/payment-repository";

const env: ApiEnv = { host: "127.0.0.1", port: 3000, databaseUrl: "postgres://u:p@127.0.0.1:1/pilla" };
const uuid = (n: number): string => `01970000-0000-7000-8000-${String(1000000000000 + n).slice(1)}`;
const PERSON = uuid(1);
const ACCOUNT = uuid(3);
const INACTIVE_ACCOUNT = uuid(5);
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
  await client.query(
    "insert into treasury.accounts (id, name, active) values ($1, 'Conta ativa', true), ($2, 'Conta inativa', false)",
    [ACCOUNT, INACTIVE_ACCOUNT],
  );
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

// Cinco parcelas de 1.200,00 (principal 1.000,00 e juros 200,00): saldo de 6.135,00 em 20/11 (multa e mora até lá).
async function seedSchedule(): Promise<void> {
  const dueDates = ["2026-09-20", "2026-10-20", "2026-11-19", "2026-11-20", "2026-12-20"];
  for (const [index, dueDate] of dueDates.entries()) {
    await client.query(
      `insert into lending.installments (id, loan_id, number, due_date, principal_cents, interest_cents, total_cents)
       values ($1, $2, $3, $4, 100000, 20000, 120000)`,
      [nextId(), LOAN, index + 1, dueDate],
    );
  }
}

async function seedPaymentWithKey(key: string): Promise<string> {
  const id = nextId();
  await client.query(
    `insert into payments.payments
       (id, loan_id, person_id, account_id, paid_at, amount_cents, method, channel, status, created_by, idempotency_key)
     values ($1, $2, $3, $4, '2026-11-20', 1000, 'PIX', 'ADMIN', 'PENDING_REVIEW', $5, $6)`,
    [id, LOAN, PERSON, ACCOUNT, USER, key],
  );
  return id;
}

type Body = {
  id?: string;
  loanId?: string;
  loanNumber?: string;
  personId?: string;
  personName?: string;
  accountId?: string;
  paidAt?: string;
  amountCents?: number;
  method?: string;
  status?: string;
  isRecovery?: boolean;
  confirmedAt?: string | null;
  reversedAt?: string | null;
  version?: number;
  reversalReason?: string | null;
  loanStatus?: string;
  allocations?: unknown[];
  outstandingCents?: number;
  code?: string;
  successorLoanId?: string;
  errors?: { field: string }[];
};
type Result = { status: number; body: Body };

function payload(fields: Record<string, unknown> = {}): Record<string, unknown> {
  return { loanId: LOAN, accountId: ACCOUNT, paidAt: "2026-11-20", amountCents: 100000, method: "PIX", ...fields };
}

async function register(fields: Record<string, unknown> = {}, key?: string): Promise<Result> {
  const call = admin.post("/api/v1/payments");
  const res = await (key === undefined ? call : call.set("Idempotency-Key", key)).send(payload(fields));
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

// Recusa grava nada: as quatro tabelas ficam como estavam.
async function expectNothingWritten(call: () => Promise<Result>): Promise<Result> {
  const before = await countRows();
  const result = await call();
  expect(await countRows()).toEqual(before);
  return result;
}

async function loanDetail(): Promise<Body> {
  const res = await admin.get(`/api/v1/loans/${LOAN}`);
  return res.body as Body;
}

describe("POST /api/v1/payments: register (E11-F02, A1 to A5)", () => {
  it("C1 (A1): answers 201 PENDING_REVIEW, version 1, with the person copied from the loan", async () => {
    await seedLoan(LOAN, "2026-0001", "ACTIVE");
    await seedSchedule();
    const { status, body } = await register();
    expect(status).toBe(201);
    expect(paymentResponse.safeParse(body).success).toBe(true);
    expect(body).toMatchObject({
      loanId: LOAN,
      loanNumber: "2026-0001",
      personId: PERSON,
      personName: "Ana Souza",
      accountId: ACCOUNT,
      paidAt: "2026-11-20",
      amountCents: 100000,
      method: "PIX",
      status: "PENDING_REVIEW",
      isRecovery: false,
      confirmedAt: null,
      reversedAt: null,
      version: 1,
      reversalReason: null,
      loanStatus: "ACTIVE",
    });
    const rows = await client.query<Record<string, unknown>>("select * from payments.payments where id = $1", [
      body.id,
    ]);
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0]).toMatchObject({
      loan_id: LOAN,
      person_id: PERSON,
      account_id: ACCOUNT,
      status: "PENDING_REVIEW",
      channel: "ADMIN",
      version: 1,
      is_recovery: false,
      receipt_attachment_id: null,
      idempotency_key: null,
    });
    expect(rows.rows[0]?.created_by).toEqual(expect.any(String));
  });

  it("C2 (A2): writes one audit row for the registration, in the same transaction", async () => {
    await seedLoan(LOAN, "2026-0001", "ACTIVE");
    await seedSchedule();
    const { body } = await register();
    const audit = await client.query<{ action: string; entity_type: string; entity_id: string; before: unknown }>(
      "select action, entity_type, entity_id, before from core.audit_log",
    );
    expect(audit.rows).toEqual([
      { action: "payment.registered", entity_type: "payment", entity_id: body.id, before: null },
    ]);
  });

  it("C3 (A3): writes no allocation and no outbox event (RN-R01)", async () => {
    await seedLoan(LOAN, "2026-0001", "ACTIVE");
    await seedSchedule();
    await register();
    const counts = await countRows();
    expect(counts["payments.payments"]).toBe(1);
    expect(counts["payments.payment_allocations"]).toBe(0);
    expect(counts["core.outbox"]).toBe(0);
  });

  it("C4 (A4): the loan balance and status do not change", async () => {
    await seedLoan(LOAN, "2026-0001", "ACTIVE");
    await seedSchedule();
    const before = await loanDetail();
    await register();
    const after = await loanDetail();
    expect(after.outstandingCents).toBe(before.outstandingCents);
    expect(after.outstandingCents).toBe(613500);
    expect(after.status).toBe("ACTIVE");
  });

  it("C5 (A5): the response has no allocation and carries the loan status", async () => {
    await seedLoan(LOAN, "2026-0001", "ACTIVE");
    await seedSchedule();
    const { body } = await register();
    expect(body.allocations).toEqual([]);
    expect(body.loanStatus).toBe("ACTIVE");
  });

  it.each(["PIX", "BOLETO", "CASH", "BANK_TRANSFER"])(
    "C6 (A1): the method %s is accepted with no receipt",
    async (method) => {
      await seedLoan(LOAN, "2026-0001", "ACTIVE");
      await seedSchedule();
      const { status, body } = await register({ method });
      expect(status).toBe(201);
      expect(body.method).toBe(method);
    },
  );

  it("C6 (A1): the amount equal to the balance at paidAt and the disbursement day are accepted", async () => {
    await seedLoan(LOAN, "2026-0001", "ACTIVE");
    await seedSchedule();
    expect((await register({ amountCents: 613500 })).status).toBe(201);
    expect((await register({ paidAt: "2026-08-20", amountCents: 1000 })).status).toBe(201);
  });
});

describe("POST /api/v1/payments: DRAFT and WRITTEN_OFF (E11-F02, A6, A7)", () => {
  it("C7 (A6): a DRAFT loan accepts the payment as PENDING_REVIEW with no ceiling and allocates nothing", async () => {
    await seedLoan(LOAN, "2026-0001", "DRAFT");
    const { status, body } = await register({ amountCents: 99999999 });
    expect(status).toBe(201);
    expect(paymentResponse.safeParse(body).success).toBe(true);
    expect(body).toMatchObject({ status: "PENDING_REVIEW", loanStatus: "DRAFT", isRecovery: false, allocations: [] });
    const counts = await countRows();
    expect(counts["payments.payment_allocations"]).toBe(0);
    expect(counts["core.outbox"]).toBe(0);
  });

  it("C8 (A7): a WRITTEN_OFF loan accepts the payment as recovery and keeps the status (RN-C20)", async () => {
    await seedLoan(LOAN, "2026-0001", "WRITTEN_OFF");
    await seedSchedule();
    const { status, body } = await register();
    expect(status).toBe(201);
    expect(body).toMatchObject({ status: "PENDING_REVIEW", isRecovery: true, loanStatus: "WRITTEN_OFF" });
    const stored = await client.query<{ is_recovery: boolean }>("select is_recovery from payments.payments");
    expect(stored.rows).toEqual([{ is_recovery: true }]);
    expect((await loanDetail()).status).toBe("WRITTEN_OFF");
  });
});

describe("POST /api/v1/payments: refusals (E11-F02, A8 to A13)", () => {
  it("C9 (A8): an unknown loan answers 404 NOT_FOUND and writes nothing", async () => {
    const { status, body } = await expectNothingWritten(() => register({ loanId: uuid(97) }));
    expect(status).toBe(404);
    expect(body.code).toBe("NOT_FOUND");
  });

  it.each([
    ["unknown", uuid(98)],
    ["inactive", INACTIVE_ACCOUNT],
  ])(
    "C10 (A9): an %s account answers 400 VALIDATION_FAILED on accountId and writes nothing",
    async (_label, accountId) => {
      await seedLoan(LOAN, "2026-0001", "ACTIVE");
      await seedSchedule();
      const { status, body } = await expectNothingWritten(() => register({ accountId }));
      expect(status).toBe(400);
      expect(body.code).toBe("VALIDATION_FAILED");
      expect(body.errors?.map((error) => error.field)).toEqual(["accountId"]);
    },
  );

  it("C10 (A9): a DRAFT loan also checks the account", async () => {
    await seedLoan(LOAN, "2026-0001", "DRAFT");
    const { status, body } = await expectNothingWritten(() => register({ accountId: INACTIVE_ACCOUNT }));
    expect(status).toBe(400);
    expect(body.errors?.map((error) => error.field)).toEqual(["accountId"]);
  });

  it("C11 (A10): an amount above the balance at paidAt answers 422 PAYMENT_EXCEEDS_BALANCE and writes nothing", async () => {
    await seedLoan(LOAN, "2026-0001", "ACTIVE");
    await seedSchedule();
    const { status, body } = await expectNothingWritten(() => register({ amountCents: 613501 }));
    expect(status).toBe(422);
    expect(body.code).toBe("PAYMENT_EXCEEDS_BALANCE");
  });

  it.each(["PAID_OFF", "RENEWED", "RENEGOTIATED", "CANCELLED"])(
    "C12 (A11): a %s loan answers 422 LOAN_CLOSED_FOR_PAYMENTS and writes nothing",
    async (loanStatus) => {
      await seedLoan(LOAN, "2026-0001", loanStatus);
      const { status, body } = await expectNothingWritten(() => register());
      expect(status).toBe(422);
      expect(body.code).toBe("LOAN_CLOSED_FOR_PAYMENTS");
      expect(body.successorLoanId).toBeUndefined();
    },
  );

  it.each(["RENEWED", "RENEGOTIATED"])(
    "C12 (A11): a %s loan with a successor carries successorLoanId",
    async (loanStatus) => {
      await seedLoan(LOAN, "2026-0001", loanStatus);
      await seedLoan(SUCCESSOR, "2026-0002", "DRAFT", LOAN);
      const { status, body } = await expectNothingWritten(() => register());
      expect(status).toBe(422);
      expect(body.code).toBe("LOAN_CLOSED_FOR_PAYMENTS");
      expect(body.successorLoanId).toBe(SUCCESSOR);
    },
  );

  it.each([
    ["before the disbursement", "2026-08-19"],
    ["in the future", "2026-11-21"],
  ])("C13 (A12): paidAt %s answers 400 VALIDATION_FAILED on paidAt and writes nothing", async (_label, paidAt) => {
    await seedLoan(LOAN, "2026-0001", "ACTIVE");
    await seedSchedule();
    const { status, body } = await expectNothingWritten(() => register({ paidAt }));
    expect(status).toBe(400);
    expect(body.code).toBe("VALIDATION_FAILED");
    expect(body.errors?.map((error) => error.field)).toEqual(["paidAt"]);
  });

  it("C14 (A13): unknown keys, destinationKey and receiptAttachmentId answer 400 VALIDATION_FAILED", async () => {
    await seedLoan(LOAN, "2026-0001", "ACTIVE");
    await seedSchedule();
    const extras: Record<string, unknown>[] = [
      { destinationKey: "chave-pix@exemplo.com" },
      { receiptAttachmentId: uuid(50) },
      { channel: "ADMIN" },
      { status: "CONFIRMED" },
      { extra: 1 },
    ];
    for (const extra of extras) {
      const { status, body } = await expectNothingWritten(() => register(extra));
      expect(status).toBe(400);
      expect(body.code).toBe("VALIDATION_FAILED");
    }
  });

  it("C15 (A13): a malformed body answers 400 VALIDATION_FAILED and writes nothing", async () => {
    await seedLoan(LOAN, "2026-0001", "ACTIVE");
    await seedSchedule();
    const bad: Record<string, unknown>[] = [
      { loanId: "x" },
      { accountId: "x" },
      { amountCents: 0 },
      { amountCents: -5 },
      { amountCents: 10.5 },
      { amountCents: "100" },
      { paidAt: "2026-13-01" },
      { method: "TED" },
      { method: "pix" },
    ];
    for (const fields of bad) {
      const { status, body } = await expectNothingWritten(() => register(fields));
      expect(status).toBe(400);
      expect(body.code).toBe("VALIDATION_FAILED");
    }
    const missing = await expectNothingWritten(async () => {
      const res = await admin.post("/api/v1/payments").send({ loanId: LOAN });
      return { status: res.status, body: res.body as Body };
    });
    expect(missing.status).toBe(400);
  });

  it("C16 (A13): a refused request leaves the four tables as they were, whatever the reason", async () => {
    await seedLoan(LOAN, "2026-0001", "ACTIVE");
    await seedSchedule();
    const first = await register();
    expect(first.status).toBe(201);
    const refused = await expectNothingWritten(() => register({ amountCents: 613501 }));
    expect(refused.status).toBe(422);
  });
});

describe("POST /api/v1/payments: Idempotency-Key (E11-F02, A14)", () => {
  it("C17 (A14): the same key returns the same payment and creates one row and one audit row", async () => {
    await seedLoan(LOAN, "2026-0001", "ACTIVE");
    await seedSchedule();
    const first = await register({}, "abertura-1");
    const second = await register({}, "abertura-1");
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body).toEqual(first.body);
    const counts = await countRows();
    expect(counts["payments.payments"]).toBe(1);
    expect(counts["core.audit_log"]).toBe(1);
    const stored = await client.query<{ idempotency_key: string }>("select idempotency_key from payments.payments");
    expect(stored.rows).toEqual([{ idempotency_key: "abertura-1" }]);
  });

  it("C17 (A14): a replay returns the stored payment even if the loan is closed meanwhile", async () => {
    await seedLoan(LOAN, "2026-0001", "ACTIVE");
    await seedSchedule();
    const first = await register({}, "abertura-2");
    await client.query("update lending.loans set status = 'PAID_OFF' where id = $1", [LOAN]);
    const replay = await register({}, "abertura-2");
    expect(replay.status).toBe(201);
    expect(replay.body.id).toBe(first.body.id);
    expect(replay.body.loanStatus).toBe("PAID_OFF");
  });

  it("C17 (A14): a lost race on the key returns the stored payment, with no second row and no second audit", async () => {
    await seedLoan(LOAN, "2026-0001", "ACTIVE");
    await seedSchedule();
    const stored = await seedPaymentWithKey("abertura-3");
    // A consulta prévia não vê a linha (outra requisição a gravou depois dela): vale a chave única do banco.
    vi.spyOn(paymentRepository, "findPaymentByIdempotencyKey").mockResolvedValueOnce(null);
    const { status, body } = await register({}, "abertura-3");
    expect(status).toBe(201);
    expect(body.id).toBe(stored);
    const counts = await countRows();
    expect(counts["payments.payments"]).toBe(1);
    expect(counts["core.audit_log"]).toBe(0);
  });

  it("C17 (A14): different keys create different payments", async () => {
    await seedLoan(LOAN, "2026-0001", "ACTIVE");
    await seedSchedule();
    const first = await register({}, "abertura-4");
    const second = await register({}, "abertura-5");
    expect(second.body.id).not.toBe(first.body.id);
    expect((await countRows())["payments.payments"]).toBe(2);
  });

  it("C18 (A14): with no key every request creates a new payment", async () => {
    await seedLoan(LOAN, "2026-0001", "ACTIVE");
    await seedSchedule();
    const first = await register();
    const second = await register();
    expect(second.body.id).not.toBe(first.body.id);
    expect((await countRows())["payments.payments"]).toBe(2);
    expect((await countRows())["core.audit_log"]).toBe(2);
  });

  it("C18 (A14): an empty key or one over 100 characters answers 400 VALIDATION_FAILED and writes nothing", async () => {
    await seedLoan(LOAN, "2026-0001", "ACTIVE");
    await seedSchedule();
    for (const key of ["", "k".repeat(101)]) {
      const { status, body } = await expectNothingWritten(() => register({}, key));
      expect(status).toBe(400);
      expect(body.code).toBe("VALIDATION_FAILED");
    }
    expect((await register({}, "k".repeat(100))).status).toBe(201);
  });
});
