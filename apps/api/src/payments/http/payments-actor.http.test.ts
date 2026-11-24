import type { PGlite } from "@electric-sql/pglite";
import type { INestApplication } from "@nestjs/common";
import type { RequestActor } from "../../core/public/actor";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp } from "../../core/http/test-app";
import { DATABASE } from "../../db/database";
import { migratedTestDb } from "../../db/test-db";
import { PaymentsService } from "../application/payments-service";
import { PaymentsController } from "./payments.controller";

const uuid = (n: number): string => `01970000-0000-7000-8000-${String(1000000000000 + n).slice(1)}`;
const PERSON = uuid(1);
const ACCOUNT = uuid(3);
const PREVIOUS_AUTHOR = uuid(4);
const LOAN = uuid(11);
const REASON = "pagamento lançado em duplicidade";
const ACTOR: RequestActor = { type: "ADMIN", adminUserId: uuid(77), ip: "203.0.113.7" };
let counter = 100;
const nextId = (): string => uuid(++counter);

let client: PGlite;
let app: INestApplication;
let baseUrl: string;

beforeAll(async () => {
  const migrated = await migratedTestDb();
  client = migrated.client;
  app = await createTestApp([PaymentsController], [PaymentsService, { provide: DATABASE, useValue: migrated.db }], {
    actor: ACTOR,
  });
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
  await client.query(
    `insert into lending.loans
       (id, loan_number, person_id, type, status, principal_cents, monthly_interest_rate_bps, installment_count,
        frequency_unit, frequency_interval, first_due_date, contracted_at, disbursed_at, account_id,
        late_fee_bps, late_interest_monthly_bps, grace_period_days, rounding_step_cents, status_changed_at)
     values ($1, '2026-0001', $2, 'INSTALLMENT', 'ACTIVE', 500000, 633, 5, 'MONTH', 1, '2026-09-20', '2026-08-15',
        '2026-08-20', $3, 250, 120, 0, 500, '2026-08-20T12:00:00Z')`,
    [LOAN, PERSON, ACCOUNT],
  );
  for (const [index, dueDate] of ["2026-09-20", "2026-10-20", "2026-11-19", "2026-11-20", "2026-12-20"].entries()) {
    await client.query(
      `insert into lending.installments (id, loan_id, number, due_date, principal_cents, interest_cents, total_cents)
       values ($1, $2, $3, $4, 100000, 20000, 120000)`,
      [nextId(), LOAN, index + 1, dueDate],
    );
  }
});
afterEach(() => {
  vi.useRealTimers();
});

async function seedPayment(status: string): Promise<string> {
  const id = nextId();
  await client.query(
    `insert into payments.payments
       (id, loan_id, person_id, account_id, paid_at, amount_cents, method, channel, status, created_by)
     values ($1, $2, $3, $4, '2026-11-20', 126000, 'PIX', 'ADMIN', $5, $6)`,
    [id, LOAN, PERSON, ACCOUNT, status, PREVIOUS_AUTHOR],
  );
  return id;
}

type PaymentBody = { id: string; version: number };

async function register(): Promise<string> {
  const res = await request(baseUrl)
    .post("/api/v1/payments")
    .send({ loanId: LOAN, accountId: ACCOUNT, paidAt: "2026-11-20", amountCents: 100000, method: "PIX" });
  expect(res.status).toBe(201);
  return (res.body as PaymentBody).id;
}

async function confirm(id: string): Promise<void> {
  const res = await request(baseUrl).post(`/api/v1/payments/${id}/confirm`).set("If-Match", "1").send({});
  expect(res.status).toBe(200);
}

async function reject(id: string): Promise<void> {
  const res = await request(baseUrl)
    .post(`/api/v1/payments/${id}/reject`)
    .set("If-Match", "1")
    .send({ reason: REASON });
  expect(res.status).toBe(200);
}

async function reverse(id: string): Promise<void> {
  const res = await request(baseUrl)
    .post(`/api/v1/payments/${id}/reverse`)
    .set("If-Match", "2")
    .send({ reason: REASON });
  expect(res.status).toBe(200);
}

async function paymentColumn(id: string, column: "created_by" | "confirmed_by" | "rejected_by" | "reversed_by") {
  const result = await client.query<{ by: string | null }>(
    `select ${column} as by from payments.payments where id = $1`,
    [id],
  );
  return result.rows[0]?.by;
}

type AuditRow = { actor_type: string; actor_id: string | null; ip: string | null; action: string };

async function auditRows(): Promise<AuditRow[]> {
  const result = await client.query<AuditRow>(
    "select actor_type, actor_id, host(ip) as ip, action from core.audit_log order by at, id",
  );
  return result.rows;
}

describe("payments record the session admin as actor (E14-F04, A1, A2, A5)", () => {
  it("C1 (A1): registering writes created_by equal to the actor adminUserId", async () => {
    const id = await register();
    expect(await paymentColumn(id, "created_by")).toBe(ACTOR.adminUserId);
  });

  it("C2 (A1): confirming writes confirmed_by equal to the actor adminUserId", async () => {
    const id = await seedPayment("PENDING_REVIEW");
    await confirm(id);
    expect(await paymentColumn(id, "confirmed_by")).toBe(ACTOR.adminUserId);
  });

  it("C3 (A1): rejecting writes rejected_by equal to the actor adminUserId", async () => {
    const id = await seedPayment("PENDING_REVIEW");
    await reject(id);
    expect(await paymentColumn(id, "rejected_by")).toBe(ACTOR.adminUserId);
  });

  it("C4 (A1): reversing writes reversed_by equal to the actor adminUserId", async () => {
    const id = await seedPayment("PENDING_REVIEW");
    await confirm(id);
    await reverse(id);
    expect(await paymentColumn(id, "reversed_by")).toBe(ACTOR.adminUserId);
  });

  it("C5 (A2): register, confirm, reject and reverse write audit rows with actor ADMIN, its id and its ip", async () => {
    const registered = await register();
    await reject(registered);
    const confirmed = await seedPayment("PENDING_REVIEW");
    await confirm(confirmed);
    await reverse(confirmed);
    const rows = await auditRows();
    expect(rows.map((row) => row.action).sort()).toEqual([
      "payment.confirmed",
      "payment.registered",
      "payment.rejected",
      "payment.reversed",
    ]);
    for (const row of rows) {
      expect(row).toMatchObject({ actor_type: "ADMIN", actor_id: ACTOR.adminUserId, ip: ACTOR.ip });
    }
  });

  it("C11 (A5): no audit row written by the payment routes has a null actor_id", async () => {
    const id = await seedPayment("PENDING_REVIEW");
    await confirm(id);
    await reverse(id);
    const nulls = await client.query("select 1 from core.audit_log where actor_id is null");
    expect(nulls.rows).toHaveLength(0);
    expect((await auditRows()).length).toBeGreaterThan(0);
  });
});
