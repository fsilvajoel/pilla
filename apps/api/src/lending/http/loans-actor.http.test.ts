import type { PGlite } from "@electric-sql/pglite";
import type { INestApplication } from "@nestjs/common";
import type { RequestActor } from "../../core/public/actor";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp } from "../../core/http/test-app";
import { DATABASE } from "../../db/database";
import { migratedTestDb } from "../../db/test-db";
import { PaymentsService } from "../../payments/application/payments-service";
import { PaymentsController } from "../../payments/http/payments.controller";
import { LoansService } from "../application/loans-service";
import { LoansController } from "./loans.controller";

const uuid = (n: number): string => `01970000-0000-7000-8000-${String(1000000000000 + n).slice(1)}`;
const PERSON = uuid(1);
const ACCOUNT = uuid(3);
const PREVIOUS_AUTHOR = uuid(4);
const ACTIVE_LOAN = uuid(11);
const ACTOR: RequestActor = { type: "ADMIN", adminUserId: uuid(77), ip: "203.0.113.7" };
let counter = 100;
const nextId = (): string => uuid(++counter);

const draftBody = {
  personId: PERSON,
  type: "INSTALLMENT",
  principalCents: 500000,
  monthlyInterestRateBps: 633,
  installmentCount: 6,
  frequency: { unit: "MONTH", interval: 1 },
  firstDueDate: "2026-12-14",
  lateFeeBps: 250,
  lateInterestMonthlyBps: 120,
  gracePeriodDays: 0,
};

let client: PGlite;
let app: INestApplication;
let baseUrl: string;

beforeAll(async () => {
  const migrated = await migratedTestDb();
  client = migrated.client;
  app = await createTestApp(
    [LoansController, PaymentsController],
    [LoansService, PaymentsService, { provide: DATABASE, useValue: migrated.db }],
    { actor: ACTOR },
  );
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
  await client.query("delete from lending.loan_number_sequences");
  await client.query("delete from lending.default_terms");
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
    `insert into lending.default_terms
       (id, late_fee_bps, late_interest_monthly_bps, grace_period_days, suggested_monthly_rate_bps, rounding_step_cents, effective_from, created_by)
     values ($1, 200, 100, 0, 1000, 500, '2026-01-01T00:00:00Z', $2)`,
    [uuid(5), PREVIOUS_AUTHOR],
  );
});
afterEach(() => {
  vi.useRealTimers();
});

async function seedActiveLoan(): Promise<void> {
  await client.query("insert into lending.loan_number_sequences (year, last_value) values (2026, 1)");
  await client.query(
    `insert into lending.loans
       (id, loan_number, person_id, type, status, principal_cents, monthly_interest_rate_bps, installment_count,
        frequency_unit, frequency_interval, first_due_date, contracted_at, disbursed_at, account_id,
        late_fee_bps, late_interest_monthly_bps, grace_period_days, rounding_step_cents, status_changed_at)
     values ($1, '2026-0001', $2, 'INSTALLMENT', 'ACTIVE', 500000, 633, 5, 'MONTH', 1, '2026-09-20', '2026-08-15',
        '2026-08-20', $3, 250, 120, 0, 500, '2026-08-20T12:00:00Z')`,
    [ACTIVE_LOAN, PERSON, ACCOUNT],
  );
  for (const [index, dueDate] of ["2026-09-20", "2026-10-20", "2026-11-19", "2026-11-20", "2026-12-20"].entries()) {
    await client.query(
      `insert into lending.installments (id, loan_id, number, due_date, principal_cents, interest_cents, total_cents)
       values ($1, $2, $3, $4, 100000, 20000, 120000)`,
      [nextId(), ACTIVE_LOAN, index + 1, dueDate],
    );
  }
}

type IdBody = { id: string };

async function createDraft(): Promise<string> {
  const res = await request(baseUrl).post("/api/v1/loans").send(draftBody);
  expect(res.status).toBe(201);
  return (res.body as IdBody).id;
}

type AuditRow = { actor_type: string; actor_id: string | null; ip: string | null; entity_id: string };

async function auditOf(action: string): Promise<AuditRow[]> {
  const result = await client.query<AuditRow>(
    "select actor_type, actor_id, host(ip) as ip, entity_id from core.audit_log where action = $1",
    [action],
  );
  return result.rows;
}

const actorRow = (entityId: string): AuditRow => ({
  actor_type: "ADMIN",
  actor_id: ACTOR.adminUserId,
  ip: ACTOR.ip,
  entity_id: entityId,
});

// Confirma um pagamento que quita o contrato (saldo de 6.135,00 em 20/11) e devolve o id do pagamento.
async function payOff(): Promise<string> {
  const id = nextId();
  await client.query(
    `insert into payments.payments
       (id, loan_id, person_id, account_id, paid_at, amount_cents, method, channel, status, created_by)
     values ($1, $2, $3, $4, '2026-11-20', 613500, 'PIX', 'ADMIN', 'PENDING_REVIEW', $5)`,
    [id, ACTIVE_LOAN, PERSON, ACCOUNT, PREVIOUS_AUTHOR],
  );
  const res = await request(baseUrl).post(`/api/v1/payments/${id}/confirm`).set("If-Match", "1").send({});
  expect(res.status).toBe(200);
  return id;
}

describe("loans record the session admin as actor in the audit (E14-F04, A3, A5)", () => {
  it("C6 (A3): creating a loan writes the audit row with the actor adminUserId and ip", async () => {
    const id = await createDraft();
    expect(await auditOf("loan.created")).toEqual([actorRow(id)]);
  });

  it("C6 (A3): updating a draft writes the audit row with the actor adminUserId and ip", async () => {
    const id = await createDraft();
    const res = await request(baseUrl).patch(`/api/v1/loans/${id}`).set("If-Match", "1").send({ gracePeriodDays: 5 });
    expect(res.status).toBe(200);
    expect(await auditOf("loan.updated")).toEqual([actorRow(id)]);
  });

  it("C7 (A3): activating a draft writes the audit row with the actor adminUserId and ip", async () => {
    const id = await createDraft();
    const res = await request(baseUrl)
      .post(`/api/v1/loans/${id}/activate`)
      .set("If-Match", "1")
      .send({ disbursedAt: "2026-11-20", accountId: ACCOUNT });
    expect(res.status).toBe(200);
    expect(await auditOf("loan.activated")).toEqual([actorRow(id)]);
  });

  it("C7 (A3): writing off a loan writes the audit row with the actor adminUserId and ip", async () => {
    await seedActiveLoan();
    const res = await request(baseUrl)
      .post(`/api/v1/loans/${ACTIVE_LOAN}/write-off`)
      .set("If-Match", "1")
      .send({ reason: "cliente sem condições de pagar" });
    expect(res.status).toBe(200);
    expect(await auditOf("loan.written_off")).toEqual([actorRow(ACTIVE_LOAN)]);
  });

  it("C8 (A3): paying a loan off writes the loan.paid_off audit row with the actor adminUserId and ip", async () => {
    await seedActiveLoan();
    await payOff();
    expect(await auditOf("loan.paid_off")).toEqual([actorRow(ACTIVE_LOAN)]);
  });

  it("C9 (A3): reopening a loan by reversal writes the loan.reopened audit row with the actor adminUserId and ip", async () => {
    await seedActiveLoan();
    const paymentId = await payOff();
    const res = await request(baseUrl)
      .post(`/api/v1/payments/${paymentId}/reverse`)
      .set("If-Match", "2")
      .send({ reason: "pagamento lançado em duplicidade" });
    expect(res.status).toBe(200);
    expect(await auditOf("loan.reopened")).toEqual([actorRow(ACTIVE_LOAN)]);
  });

  it("C11 (A5): no loan audit row written by these routes has a null actor_id", async () => {
    await seedActiveLoan();
    const paymentId = await payOff();
    await request(baseUrl)
      .post(`/api/v1/payments/${paymentId}/reverse`)
      .set("If-Match", "2")
      .send({ reason: "pagamento lançado em duplicidade" });
    const draft = await createDraft();
    await request(baseUrl).patch(`/api/v1/loans/${draft}`).set("If-Match", "1").send({ gracePeriodDays: 5 });
    const nulls = await client.query("select 1 from core.audit_log where actor_id is null");
    expect(nulls.rows).toHaveLength(0);
    const all = await client.query("select 1 from core.audit_log where entity_type = 'loan'");
    expect(all.rows.length).toBeGreaterThanOrEqual(4);
  });
});
