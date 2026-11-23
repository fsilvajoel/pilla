import type { PGlite } from "@electric-sql/pglite";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AppModule } from "../../app.module";
import { configureApp } from "../../core/http/configure-app";
import type { ApiEnv } from "../../core/http/env";
import { dispatchOutbox } from "../../core/infra/outbox-dispatcher";
import { DATABASE_HANDLE } from "../../db/database";
import { migratedTestDb } from "../../db/test-db";
import { treasuryOutboxConsumers } from "../public/outbox-consumers";

// E12-F04 (RF-32, RN-T01; E12 D7, D8; ADR-0005: o painel calcula na hora e não grava nada).
// Contrato da base: 30.000,00 a 5% a.m. em 3 parcelas mensais, desembolso em 2026-11-14, 1º vencimento 2026-11-30.
// Juros simples (ADR-0004): 3.000.000 × 5% × 3 = 450.000; cada parcela = P 1.000.000 + I 150.000 = 1.150.000,
// com vencimentos 2026-11-30, 2026-12-30 e 2027-01-30. Multa 2% sem juros de mora nem carência: a parcela 1 paga em
// 2026-12-05 leva 2% × 1.150.000 = 23.000 de encargos.
const env: ApiEnv = { host: "127.0.0.1", port: 3000, databaseUrl: "postgres://u:p@127.0.0.1:1/pilla" };
const uuid = (n: number): string => `01970000-0000-7000-8000-${String(1000000000000 + n).slice(1)}`;
const PERSON = uuid(1);
const ACCOUNT = uuid(2);
const USER = uuid(3);
const LOAN = uuid(10);
const PAYMENT = uuid(20);
const CAPITAL_ENTRY = uuid(30);
const WITHDRAWAL_ENTRY = uuid(31);
const PRINCIPAL = 3000000;
const CAPITAL = 10000000;
const INSTALLMENT = 1150000;
const FIRST_LATE_FEE = 23000;

type Summary = {
  readonly month: string;
  readonly cashCents: number;
  readonly lentCents: number;
  readonly committedBps: number | null;
  readonly availableBps: number | null;
  readonly maxCommittedBps: number | null;
  readonly interestReceivedCents: number;
  readonly lateChargesReceivedCents: number;
  readonly recoveredCents: number;
  readonly lossesCents: number;
  readonly forecastCents: number;
};

let client: PGlite;
let db: PgliteDatabase;
let app: INestApplication;
let baseUrl: string;

beforeAll(async () => {
  const migrated = await migratedTestDb();
  client = migrated.client;
  db = migrated.db;
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
  vi.setSystemTime(new Date("2026-12-05T15:00:00Z"));
  for (const table of [
    "treasury.ledger_entries",
    "payments.payment_allocations",
    "payments.payments",
    "lending.installments",
    "lending.loans",
    "lending.loan_number_sequences",
    "core.processed_events",
    "core.outbox",
    "core.audit_log",
    "treasury.accounts",
    "people.persons",
  ]) {
    await client.query(`delete from ${table}`);
  }
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
     values ($1, '2026-0001', $2, 'INSTALLMENT', 'DRAFT', $3, 500, 3, 'MONTH', 1, '2026-11-30', '2026-11-10',
        null, null, null, null, 0, 200, 0, 0, 100)`,
    [LOAN, PERSON, PRINCIPAL],
  );
});
afterEach(() => {
  vi.useRealTimers();
});

/** Aporte gravado direto no ledger: a rota de lançamento manual (E12-F02) não faz parte desta feature. */
async function seedCapital(id: string, amountCents: number, type: "CAPITAL_IN" | "CAPITAL_OUT"): Promise<void> {
  await client.query(
    `insert into treasury.ledger_entries (id, account_id, type, amount_cents, entry_date, created_by)
     values ($1, $2, $3, $4, '2026-11-10', $5)`,
    [id, ACCOUNT, type, amountCents, USER],
  );
}

async function activate(): Promise<void> {
  const res = await request(baseUrl)
    .post(`/api/v1/loans/${LOAN}/activate`)
    .set("If-Match", "1")
    .send({ disbursedAt: "2026-11-14", accountId: ACCOUNT });
  expect(res.status).toBe(200);
  await dispatch();
}

async function pay(paidAt: string, amountCents: number): Promise<void> {
  await client.query(
    `insert into payments.payments
       (id, loan_id, person_id, account_id, paid_at, amount_cents, method, channel, status, created_by, version)
     values ($1, $2, $3, $4, $5, $6, 'PIX', 'ADMIN', 'PENDING_REVIEW', $7, 1)`,
    [PAYMENT, LOAN, PERSON, ACCOUNT, paidAt, amountCents, USER],
  );
  const res = await request(baseUrl).post(`/api/v1/payments/${PAYMENT}/confirm`).set("If-Match", "1").send({});
  expect(res.status).toBe(200);
  await dispatch();
}

async function reverse(): Promise<void> {
  const res = await request(baseUrl)
    .post(`/api/v1/payments/${PAYMENT}/reverse`)
    .set("If-Match", "2")
    .send({ reason: "pagamento lançado em duplicidade" });
  expect(res.status).toBe(200);
  await dispatch();
}

async function writeOff(): Promise<void> {
  const res = await request(baseUrl)
    .post(`/api/v1/loans/${LOAN}/write-off`)
    .set("If-Match", "2")
    .send({ reason: "Devedor sem localização há 120 dias" });
  expect(res.status).toBe(200);
  await dispatch();
}

async function dispatch(): Promise<void> {
  const result = await dispatchOutbox(db, treasuryOutboxConsumers);
  expect(result.failed).toBe(0);
}

async function summary(month?: string): Promise<Summary> {
  const req = request(baseUrl).get("/api/v1/treasury/summary");
  const res = await (month === undefined ? req : req.query({ month }));
  expect(res.status).toBe(200);
  return res.body as Summary;
}

async function rowCounts(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const table of ["treasury.ledger_entries", "core.outbox", "core.audit_log", "core.processed_events"]) {
    const result = await client.query<{ total: number }>(`select count(*)::int as total from ${table}`);
    counts[table] = result.rows[0]?.total ?? -1;
  }
  return counts;
}

const EMPTY: Summary = {
  month: "2026-12",
  cashCents: 0,
  lentCents: 0,
  committedBps: null,
  availableBps: null,
  maxCommittedBps: null,
  interestReceivedCents: 0,
  lateChargesReceivedCents: 0,
  recoveredCents: 0,
  lossesCents: 0,
  forecastCents: 0,
};

describe("GET /api/v1/treasury/summary (E12-F04, D7)", () => {
  it("C1 (A1): an empty base answers zero everywhere, null percentages and the current Brasília month", async () => {
    expect(await summary()).toEqual(EMPTY);
  });

  it("C2 (A2): capital of 100.000,00 and a 30.000,00 loan commit 30% of the money", async () => {
    await client.query("update treasury.accounts set max_committed_bps = 8000 where id = $1", [ACCOUNT]);
    await seedCapital(CAPITAL_ENTRY, CAPITAL, "CAPITAL_IN");
    await activate();
    // Caixa 10.000.000 - 3.000.000; comprometido 3.000.000 × 10000 / 10.000.000 = 3000.
    // Previsão de dezembro: só a parcela 2 (vence 2026-12-30), 1.150.000.
    expect(await summary()).toEqual({
      ...EMPTY,
      cashCents: 7000000,
      lentCents: 3000000,
      committedBps: 3000,
      availableBps: 7000,
      maxCommittedBps: 8000,
      forecastCents: INSTALLMENT,
    });
  });

  it("C3 (A3): a confirmed payment lowers lent by the principal paid and adds interest and late charges", async () => {
    await seedCapital(CAPITAL_ENTRY, CAPITAL, "CAPITAL_IN");
    await activate();
    await pay("2026-12-05", INSTALLMENT + FIRST_LATE_FEE);
    // Caixa 7.000.000 + 1.173.000; emprestado 3.000.000 - 1.000.000.
    // Comprometido floor(2.000.000 × 10000 / 10.173.000) = floor(1965,98) = 1965.
    expect(await summary()).toEqual({
      ...EMPTY,
      cashCents: 8173000,
      lentCents: 2000000,
      committedBps: 1965,
      availableBps: 8035,
      interestReceivedCents: 150000,
      lateChargesReceivedCents: FIRST_LATE_FEE,
      forecastCents: INSTALLMENT,
    });
  });

  it("C4 (A4): reversing the payment undoes it in the month of the reversal", async () => {
    await seedCapital(CAPITAL_ENTRY, CAPITAL, "CAPITAL_IN");
    await activate();
    await pay("2026-12-05", INSTALLMENT + FIRST_LATE_FEE);
    vi.setSystemTime(new Date("2027-01-05T15:00:00Z"));
    await reverse();
    // O estorno é lançado em 2027-01-05: janeiro recebe os componentes negativos, dezembro fica como estava.
    // Previsão de janeiro: parcela 3 (vence 2027-01-30), 1.150.000; as parcelas 1 e 2 vencem fora do mês.
    expect(await summary()).toEqual({
      ...EMPTY,
      month: "2027-01",
      cashCents: 7000000,
      lentCents: 3000000,
      committedBps: 3000,
      availableBps: 7000,
      interestReceivedCents: -150000,
      lateChargesReceivedCents: -FIRST_LATE_FEE,
      forecastCents: INSTALLMENT,
    });
    const december = await summary("2026-12");
    expect(december.interestReceivedCents).toBe(150000);
    expect(december.lateChargesReceivedCents).toBe(FIRST_LATE_FEE);
    expect(december.cashCents).toBe(7000000);
  });

  it("C5 (A5): writing off moves the principal from lent to losses; recovery goes to cash, not to interest", async () => {
    vi.setSystemTime(new Date("2026-11-20T15:00:00Z"));
    await seedCapital(CAPITAL_ENTRY, CAPITAL, "CAPITAL_IN");
    await activate();
    await writeOff();
    // Novembro: a parcela 1 (2026-11-30) é de um contrato baixado, fora da previsão.
    const writtenOff: Summary = {
      ...EMPTY,
      month: "2026-11",
      cashCents: 7000000,
      lentCents: 0,
      committedBps: 0,
      availableBps: 10000,
      lossesCents: PRINCIPAL,
    };
    expect(await summary()).toEqual(writtenOff);

    await pay("2026-11-20", 500000);
    // Antes de qualquer vencimento e sem encargos, a recuperação paga os juros da parcela 1 (150.000) e depois o
    // principal (350.000): sobram 2.650.000 de principal em aberto.
    const allocated = await client.query<{ principal: number }>(
      "select coalesce(sum(principal_cents), 0)::int as principal from payments.payment_allocations where reversed_at is null",
    );
    expect(allocated.rows[0]?.principal).toBe(350000);
    expect(await summary()).toEqual({
      ...writtenOff,
      cashCents: 7500000,
      recoveredCents: 500000,
      lossesCents: 2650000,
    });
  });

  it("C6 (A7): another month changes only the month figures and the forecast", async () => {
    await seedCapital(CAPITAL_ENTRY, CAPITAL, "CAPITAL_IN");
    await activate();
    await pay("2026-12-05", INSTALLMENT + FIRST_LATE_FEE);
    const now = { cashCents: 8173000, lentCents: 2000000, committedBps: 1965, availableBps: 8035 };
    // Novembro: a parcela 1 vence no mês mas está paga; o pagamento é de dezembro.
    expect(await summary("2026-11")).toEqual({ ...EMPTY, ...now, month: "2026-11" });
    // Janeiro: só a parcela 3 na previsão.
    expect(await summary("2027-01")).toEqual({ ...EMPTY, ...now, month: "2027-01", forecastCents: INSTALLMENT });
  });

  it("C7 (A8): cash plus lent at zero or below gives null percentages", async () => {
    await activate();
    // Sem aporte: caixa -3.000.000 e emprestado 3.000.000, denominador 0.
    expect(await summary()).toEqual({
      ...EMPTY,
      cashCents: -PRINCIPAL,
      lentCents: PRINCIPAL,
      forecastCents: INSTALLMENT,
    });
    await seedCapital(WITHDRAWAL_ENTRY, -1000000, "CAPITAL_OUT");
    // Denominador -4.000.000 + 3.000.000 = -1.000.000.
    const negative = await summary();
    expect(negative.cashCents).toBe(-4000000);
    expect(negative.committedBps).toBeNull();
    expect(negative.availableBps).toBeNull();
  });

  it.each(["2027-13", "2027-1", "01/2027", "1999-12"])("C8 a C10 (A9): month %j answers 400", async (month) => {
    const res = await request(baseUrl).get("/api/v1/treasury/summary").query({ month });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: "VALIDATION_FAILED" });
  });

  it("A11: reading the summary writes nothing", async () => {
    await seedCapital(CAPITAL_ENTRY, CAPITAL, "CAPITAL_IN");
    await activate();
    await pay("2026-12-05", INSTALLMENT + FIRST_LATE_FEE);
    const before = await rowCounts();
    await summary();
    await summary("2027-01");
    expect(await rowCounts()).toEqual(before);
  });
});
