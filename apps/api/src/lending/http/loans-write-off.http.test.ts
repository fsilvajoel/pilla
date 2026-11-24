import type { PGlite } from "@electric-sql/pglite";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { loanWrittenOffV1 } from "@pilla/schemas";
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

type LoanBody = { status?: string; version?: number; code?: string; errors?: { field: string }[] };
type DbLoan = { status: string; version: number; write_off_reason: string | null; changed: boolean };
type OutboxDbRow = { event_type: string; event_version: number; aggregate_id: string; payload: unknown };

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

async function seedLoan(status: string): Promise<void> {
  await client.query("insert into lending.loan_number_sequences (year, last_value) values (2026, 1)");
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

// Cinco parcelas de 1.000,00 de principal; a parcela 1 recebe o principal inteiro, então o principal em aberto é 4.000,00.
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
     values ($1, $2, $3, $4, '2026-11-01', 1, 'CASH', 'ADMIN', 'CONFIRMED', $5)`,
    [paymentId, LOAN, PERSON, ACCOUNT, USER],
  );
  await client.query(
    `insert into payments.payment_allocations
       (id, payment_id, loan_id, installment_id, late_charges_cents, interest_cents, principal_cents)
     values ($1, $2, $3, $4, 0, 20000, 100000)`,
    [nextId(), paymentId, LOAN, ids[0]],
  );
}

async function dbLoan(): Promise<DbLoan | undefined> {
  const result = await client.query<DbLoan>(
    "select status, version, write_off_reason, status_changed_at is not null as changed from lending.loans where id = $1",
    [LOAN],
  );
  return result.rows[0];
}

async function outbox(): Promise<OutboxDbRow[]> {
  const result = await client.query<OutboxDbRow>(
    "select event_type, event_version, aggregate_id, payload from core.outbox order by event_type",
  );
  return result.rows;
}

async function auditActions(): Promise<string[]> {
  const result = await client.query<{ action: string }>("select action from core.audit_log order by action");
  return result.rows.map((row) => row.action);
}

function writeOff(id: string, version: string | undefined, payload: object) {
  const req = admin.post(`/api/v1/loans/${id}/write-off`);
  return (version === undefined ? req : req.set("If-Match", version)).send(payload);
}

async function expectNothingWritten(status: string): Promise<void> {
  expect(await dbLoan()).toMatchObject({ status, version: 1, write_off_reason: null });
  expect(await outbox()).toHaveLength(0);
  expect(await auditActions()).toHaveLength(0);
}

const REASON = "Devedor sem localização há 120 dias";

describe("POST /api/v1/loans/{id}/write-off: feliz (E10-F07, A1 a A3)", () => {
  it("C1 (A1): ACTIVE becomes WRITTEN_OFF, answers 200 and bumps the version", async () => {
    await seedLoan("ACTIVE");
    await seedSchedule();
    const res = await writeOff(LOAN, "1", { reason: REASON });
    const body = res.body as LoanBody;
    expect(res.status).toBe(200);
    expect(body.status).toBe("WRITTEN_OFF");
    expect(body.version).toBe(2);
    expect(await dbLoan()).toMatchObject({ status: "WRITTEN_OFF", version: 2, changed: true });
  });

  it("C2 (A2): the reason is stored trimmed in write_off_reason", async () => {
    await seedLoan("ACTIVE");
    await seedSchedule();
    await writeOff(LOAN, "1", { reason: `  ${REASON}  ` });
    expect((await dbLoan())?.write_off_reason).toBe(REASON);
  });

  it("C3 (A3): writes one LoanWrittenOff that parses, with the open principal and the reason", async () => {
    await seedLoan("ACTIVE");
    await seedSchedule();
    await writeOff(LOAN, "1", { reason: REASON });
    const events = await outbox();
    expect(events).toHaveLength(1);
    const [event] = events;
    expect(event?.event_type).toBe("LoanWrittenOff");
    expect(event?.event_version).toBe(1);
    expect(event?.aggregate_id).toBe(LOAN);
    const parsed = loanWrittenOffV1.safeParse({
      id: nextId(),
      type: event?.event_type,
      version: event?.event_version,
      occurredAt: "2026-11-20T15:00:00.000Z",
      aggregateId: event?.aggregate_id,
      payload: event?.payload,
    });
    expect(parsed.success).toBe(true);
    expect(event?.payload).toEqual({ loanId: LOAN, outstandingPrincipalCents: 400000, reason: REASON });
  });

  it("C4 (A3): without payments the outstanding principal is the whole schedule principal", async () => {
    await seedLoan("ACTIVE");
    await client.query(
      `insert into lending.installments (id, loan_id, number, due_date, principal_cents, interest_cents, total_cents)
       values ($1, $2, 1, '2026-12-20', 500000, 100000, 600000)`,
      [nextId(), LOAN],
    );
    await writeOff(LOAN, "1", { reason: REASON });
    expect((await outbox())[0]?.payload).toMatchObject({ outstandingPrincipalCents: 500000 });
    expect(await auditActions()).toEqual(["loan.written_off"]);
  });
});

describe("POST /api/v1/loans/{id}/write-off: recusas (A4)", () => {
  it("C5 (A4): blank or missing reason answers 400 VALIDATION_FAILED on reason, writing nothing", async () => {
    await seedLoan("ACTIVE");
    await seedSchedule();
    const blank = await writeOff(LOAN, "1", { reason: "   " });
    const missing = await writeOff(LOAN, "1", {});
    expect(blank.status).toBe(400);
    expect((blank.body as LoanBody).code).toBe("VALIDATION_FAILED");
    expect((blank.body as LoanBody).errors?.map((e) => e.field)).toContain("reason");
    expect(missing.status).toBe(400);
    await expectNothingWritten("ACTIVE");
  });

  it("C6 (A4): a loan that is not ACTIVE answers LOAN_NOT_EDITABLE (422 in the catalog), writing nothing", async () => {
    await seedLoan("DRAFT");
    const res = await writeOff(LOAN, "1", { reason: REASON });
    expect(res.status).toBe(422);
    expect((res.body as LoanBody).code).toBe("LOAN_NOT_EDITABLE");
    await expectNothingWritten("DRAFT");
  });

  it("C7 (A4): wrong or missing If-Match answers 409 VERSION_CONFLICT, writing nothing", async () => {
    await seedLoan("ACTIVE");
    await seedSchedule();
    const wrong = await writeOff(LOAN, "7", { reason: REASON });
    const missing = await writeOff(LOAN, undefined, { reason: REASON });
    expect(wrong.status).toBe(409);
    expect((wrong.body as LoanBody).code).toBe("VERSION_CONFLICT");
    expect(missing.status).toBe(409);
    await expectNothingWritten("ACTIVE");
  });

  it("C7b: unknown loan answers 404", async () => {
    const res = await writeOff(uuid(99), "1", { reason: REASON });
    expect(res.status).toBe(404);
  });
});
