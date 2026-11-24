import type { PGlite } from "@electric-sql/pglite";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
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
  await client.query("delete from core.outbox");
  await client.query("delete from core.audit_log");
  await client.query("delete from treasury.accounts");
  await client.query("delete from people.persons");
  await client.query(
    "insert into people.persons (id, full_name, cpf, phone) values ($1, 'Ana Souza', '52998224725', '+5511987654321')",
    [PERSON],
  );
  await client.query("insert into treasury.accounts (id, name, active) values ($1, 'Conta ativa', true)", [ACCOUNT]);
  await client.query(
    `insert into lending.loans
       (id, loan_number, person_id, type, status, principal_cents, monthly_interest_rate_bps, installment_count,
        frequency_unit, frequency_interval, first_due_date, contracted_at, disbursed_at, account_id,
        late_fee_bps, late_interest_monthly_bps, grace_period_days, rounding_step_cents)
     values ($1, '2026-0001', $2, 'INSTALLMENT', 'ACTIVE', 500000, 633, 5, 'MONTH', 1, '2026-09-20', '2026-08-15',
        '2026-08-20', $3, 250, 120, 0, 500)`,
    [LOAN, PERSON, ACCOUNT],
  );
  const dueDates = ["2026-09-20", "2026-10-20", "2026-11-19", "2026-11-20", "2026-12-20"];
  for (const [index, dueDate] of dueDates.entries()) {
    await client.query(
      `insert into lending.installments (id, loan_id, number, due_date, principal_cents, interest_cents, total_cents)
       values ($1, $2, $3, $4, 100000, 20000, 120000)`,
      [uuid(200 + index), LOAN, index + 1, dueDate],
    );
  }
});
afterEach(() => {
  vi.useRealTimers();
});

async function seedPayment(id: string, amountCents: number): Promise<void> {
  await client.query(
    `insert into payments.payments
       (id, loan_id, person_id, account_id, paid_at, amount_cents, method, channel, status, created_by)
     values ($1, $2, $3, $4, '2026-11-20', $5, 'PIX', 'ADMIN', 'PENDING_REVIEW', $6)`,
    [id, LOAN, PERSON, ACCOUNT, amountCents, USER],
  );
}

const confirmCall = (id: string): Promise<{ status: number; code: string | undefined }> =>
  admin
    .post(`/api/v1/payments/${id}/confirm`)
    .set("If-Match", "1")
    .send({})
    .then((res) => ({ status: res.status, code: (res.body as { code?: string }).code }));

describe("POST /api/v1/payments/{id}/confirm: concurrency (E11-F03, A21)", () => {
  it("C25 (A21): two simultaneous confirmations that together exceed the balance: one passes, one gets 422", async () => {
    const first = uuid(301);
    const second = uuid(302);
    // Saldo de 6.135,00 em 20/11: 4.000,00 + 4.000,00 não cabem.
    await seedPayment(first, 400000);
    await seedPayment(second, 400000);
    const results = await Promise.all([confirmCall(first), confirmCall(second)]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 422]);
    expect(results.find((result) => result.status === 422)?.code).toBe("PAYMENT_EXCEEDS_BALANCE");
    const allocated = await client.query<{ total: string }>(
      "select sum(late_charges_cents + interest_cents + principal_cents)::text as total from payments.payment_allocations",
    );
    expect(allocated.rows[0]?.total).toBe("400000");
    const confirmed = await client.query<{ n: string }>(
      "select count(*)::text as n from payments.payments where status = 'CONFIRMED'",
    );
    expect(confirmed.rows[0]?.n).toBe("1");
  });

  it("C25 (A21): no installment is allocated above its own value", async () => {
    const ids = [uuid(311), uuid(312), uuid(313)];
    for (const id of ids) await seedPayment(id, 300000);
    await Promise.all(ids.map(confirmCall));
    const perInstallment = await client.query<{ total: string }>(
      `select sum(principal_cents + interest_cents)::text as total from payments.payment_allocations
         group by installment_id`,
    );
    expect(perInstallment.rows.length).toBeGreaterThan(0);
    const confirmed = await client.query<{ n: string }>(
      "select count(*)::text as n from payments.payments where status = 'CONFIRMED'",
    );
    // 3.000,00 + 3.000,00 cabem no saldo de 6.135,00; o terceiro não.
    expect(confirmed.rows[0]?.n).toBe("2");
    for (const row of perInstallment.rows) expect(Number(row.total)).toBeLessThanOrEqual(120000);
    const total = await client.query<{ total: string }>(
      "select sum(late_charges_cents + interest_cents + principal_cents)::text as total from payments.payment_allocations",
    );
    expect(Number(total.rows[0]?.total)).toBeLessThanOrEqual(613500);
  });
});
