import type { PGlite } from "@electric-sql/pglite";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { type AdminAgent, loginAsAdmin } from "../../core/http/test-admin-agent";
import { AppModule } from "../../app.module";
import { configureApp } from "../../core/http/configure-app";
import type { ApiEnv } from "../../core/http/env";
import { dispatchOutbox } from "../../core/infra/outbox-dispatcher";
import { DATABASE_HANDLE } from "../../db/database";
import { migratedTestDb } from "../../db/test-db";
import { treasuryOutboxConsumers } from "../public/outbox-consumers";

// E12-F01 C23, C24 (A14): ativar e confirmar pela API, rodar o despachante e conferir o saldo da conta no ledger.
const env: ApiEnv = {
  host: "127.0.0.1",
  port: 3000,
  databaseUrl: "postgres://u:p@127.0.0.1:1/pilla",
  accessHashKey: "chave-de-teste-do-hash-com-mais-de-32-caracteres",
};
const uuid = (n: number): string => `01970000-0000-7000-8000-${String(1000000000000 + n).slice(1)}`;
const PERSON = uuid(1);
const ACCOUNT = uuid(2);
const USER = uuid(3);
const LOAN = uuid(10);
const PAYMENT = uuid(20);
// CA-01: 5.000,00 em 6 parcelas; a primeira vale 1.150,00 (83.333 de principal e 31.667 de juros).
const PRINCIPAL = 500000;
const FIRST_INSTALLMENT = 115000;

let client: PGlite;
let admin: AdminAgent;
let db: PgliteDatabase;
let app: INestApplication;
let baseUrl: string;

beforeAll(async () => {
  const migrated = await migratedTestDb();
  client = migrated.client;
  db = migrated.db;
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
  await client.query("delete from treasury.ledger_entries");
  await client.query("delete from payments.payment_allocations");
  await client.query("delete from payments.payments");
  await client.query("delete from lending.installments");
  await client.query("delete from lending.loans");
  await client.query("delete from core.processed_events");
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
        origin_loan_id, origin_type, capitalized_amount_cents,
        late_fee_bps, late_interest_monthly_bps, grace_period_days, rounding_step_cents)
     values ($1, '2026-0001', $2, 'INSTALLMENT', 'DRAFT', $3, 633, 6, 'MONTH', 1, '2026-12-14', '2026-11-10',
        null, null, null, null, 0, 250, 120, 0, 500)`,
    [LOAN, PERSON, PRINCIPAL],
  );
});
afterEach(() => {
  vi.useRealTimers();
});

async function balance(): Promise<number> {
  const result = await client.query<{ total: number }>(
    "select coalesce(sum(amount_cents), 0)::int as total from treasury.ledger_entries where account_id = $1",
    [ACCOUNT],
  );
  return result.rows[0]?.total ?? -1;
}

async function ledgerTypes(): Promise<string[]> {
  const result = await client.query<{ type: string }>(
    "select distinct type from treasury.ledger_entries order by type",
  );
  return result.rows.map((r) => r.type);
}

async function activateAndConfirm(): Promise<void> {
  const activated = await admin
    .post(`/api/v1/loans/${LOAN}/activate`)
    .set("If-Match", "1")
    .send({ disbursedAt: "2026-11-14", accountId: ACCOUNT });
  expect(activated.status).toBe(200);
  await client.query(
    `insert into payments.payments
       (id, loan_id, person_id, account_id, paid_at, amount_cents, method, channel, status, created_by, version)
     values ($1, $2, $3, $4, '2026-11-20', $5, 'PIX', 'ADMIN', 'PENDING_REVIEW', $6, 1)`,
    [PAYMENT, LOAN, PERSON, ACCOUNT, FIRST_INSTALLMENT, USER],
  );
  const confirmed = await admin.post(`/api/v1/payments/${PAYMENT}/confirm`).set("If-Match", "1").send({});
  expect(confirmed.status).toBe(200);
}

describe("ledger a partir dos eventos, pela API (E12-F01 C23, C24, A14)", () => {
  it("C23: activation plus confirmation leave the account balance at -principal + paid", async () => {
    await activateAndConfirm();
    const result = await dispatchOutbox(db, treasuryOutboxConsumers);
    expect(result.failed).toBe(0);
    expect(await ledgerTypes()).toEqual(["DISBURSEMENT", "REPAYMENT"]);
    expect(await balance()).toBe(-385000);
  });

  it("C24: reversing the payment and dispatching again brings the balance back to -principal", async () => {
    await activateAndConfirm();
    await dispatchOutbox(db, treasuryOutboxConsumers);
    const reversed = await admin
      .post(`/api/v1/payments/${PAYMENT}/reverse`)
      .set("If-Match", "2")
      .send({ reason: "pagamento lançado em duplicidade" });
    expect(reversed.status).toBe(200);
    const result = await dispatchOutbox(db, treasuryOutboxConsumers);
    expect(result.failed).toBe(0);
    expect(await ledgerTypes()).toEqual(["DISBURSEMENT", "REPAYMENT", "REVERSAL"]);
    expect(await balance()).toBe(-500000);
  });
});
