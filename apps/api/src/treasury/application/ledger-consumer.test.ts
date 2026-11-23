import type { PGlite } from "@electric-sql/pglite";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { dispatchOutbox } from "../../core/infra/outbox-dispatcher";
import { writeOutboxEvent } from "../../core/infra/outbox-writer";
import { SYSTEM_ACTOR_ID } from "../../core/infra/system-actor";
import { migratedTestDb } from "../../db/test-db";
import { treasuryLedgerConsumer } from "./ledger-consumer";

// E12-F01 C13 a C22: consumidor treasury-ledger (E12 D3) com eventos gravados no outbox e o despachante real.
const uuid = (n: number): string => `01970000-0000-7000-8000-${String(1000000000000 + n).slice(1)}`;
const ACCOUNT = uuid(1);
const PERSON = uuid(2);
const LOAN = uuid(3);
const ORIGIN_LOAN = uuid(4);
const PAYMENT = uuid(5);
const INSTALLMENT_1 = uuid(6);
const INSTALLMENT_2 = uuid(7);
// 2026-11-21 02:00 UTC ainda é 2026-11-20 em Brasília: o estorno usa a data de Brasília.
const NOW = "2026-11-21T02:00:00Z";
const TODAY_BRASILIA = "2026-11-20";
let counter = 100;
const nextId = (): string => uuid(++counter);

let client: PGlite;
let db: PgliteDatabase;

beforeAll(async () => {
  const migrated = await migratedTestDb();
  client = migrated.client;
  db = migrated.db;
});
afterAll(async () => {
  await client.close();
});
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(NOW));
  await client.query("delete from treasury.ledger_entries");
  await client.query("delete from treasury.accounts");
  await client.query("delete from core.processed_events");
  await client.query("delete from core.outbox");
  await client.query("insert into treasury.accounts (id, name, active) values ($1, 'Conta principal', true)", [
    ACCOUNT,
  ]);
});
afterEach(() => {
  vi.useRealTimers();
});

const run = () => dispatchOutbox(db, [treasuryLedgerConsumer]);

async function emit(type: string, payload: unknown, occurredAt = "2026-11-20T12:00:00.000Z"): Promise<string> {
  const id = nextId();
  await writeOutboxEvent(db, { id, type, version: 1, occurredAt, aggregateId: LOAN, payload });
  return id;
}

type LoanActivatedPayload = {
  loanId: string;
  personId: string;
  accountId: string;
  principalCents: unknown;
  disbursedAt: string;
  originLoanId?: string;
  originType?: string;
};

const loanActivated = (extra: Partial<LoanActivatedPayload> = {}): LoanActivatedPayload => ({
  loanId: LOAN,
  personId: PERSON,
  accountId: ACCOUNT,
  principalCents: 500000,
  disbursedAt: "2026-11-14",
  ...extra,
});

type AllocationPayload = {
  installmentId: string;
  lateChargesCents: number;
  interestCents: number;
  principalCents: number;
};

const allocation = (
  installmentId: string,
  lateChargesCents: number,
  interestCents: number,
  principalCents: number,
): AllocationPayload => ({ installmentId, lateChargesCents, interestCents, principalCents });

const paymentConfirmed = (amountCents: number, allocations: AllocationPayload[], isRecovery = false) => ({
  paymentId: PAYMENT,
  loanId: LOAN,
  personId: PERSON,
  accountId: ACCOUNT,
  paidAt: "2026-11-10",
  amountCents,
  allocations,
  isRecovery,
});

const paymentReversed = (amountCents: number, allocations: AllocationPayload[]) => ({
  paymentId: PAYMENT,
  loanId: LOAN,
  accountId: ACCOUNT,
  amountCents,
  allocations,
  reason: "pagamento lançado em duplicidade",
});

type EntryRow = {
  account_id: string;
  type: string;
  component: string;
  amount_cents: number;
  source_type: string;
  source_id: string;
  source_event_id: string;
  entry_date: string;
  created_by: string;
};

async function entries(): Promise<EntryRow[]> {
  const result = await client.query<EntryRow>(
    `select account_id, type, component, amount_cents::int as amount_cents, source_type, source_id,
            source_event_id, to_char(entry_date, 'YYYY-MM-DD') as entry_date, created_by
     from treasury.ledger_entries order by type, component`,
  );
  return result.rows;
}

type Summary = { type: string; component: string; amount: number; date: string };

async function summary(): Promise<Summary[]> {
  return (await entries()).map((e) => ({
    type: e.type,
    component: e.component,
    amount: e.amount_cents,
    date: e.entry_date,
  }));
}

async function paymentSum(): Promise<number> {
  const result = await client.query<{ total: number }>(
    "select coalesce(sum(amount_cents), 0)::int as total from treasury.ledger_entries where source_id = $1",
    [PAYMENT],
  );
  return result.rows[0]?.total ?? -1;
}

type OutboxState = { published: boolean; attempts: number; failed: boolean };

async function outboxState(id: string): Promise<OutboxState | undefined> {
  const result = await client.query<OutboxState>(
    `select published_at is not null as published, attempts, last_error is not null as failed
     from core.outbox where id = $1`,
    [id],
  );
  return result.rows[0];
}

async function processedBy(consumer: string): Promise<number> {
  const result = await client.query<{ n: number }>(
    "select count(*)::int as n from core.processed_events where consumer = $1",
    [consumer],
  );
  return result.rows[0]?.n ?? -1;
}

const PUBLISHED: OutboxState = { published: true, attempts: 0, failed: false };

describe("treasury-ledger: desembolso (E12-F01 C13 a C15, A1 a A3)", () => {
  it("C13 (A1): a new loan activation writes a DISBURSEMENT of -principal in the event account", async () => {
    const eventId = await emit("LoanActivated", loanActivated());
    expect(await run()).toEqual({ published: 1, failed: 0 });
    expect(await entries()).toEqual([
      {
        account_id: ACCOUNT,
        type: "DISBURSEMENT",
        component: "PRINCIPAL",
        amount_cents: -500000,
        source_type: "LOAN",
        source_id: LOAN,
        source_event_id: eventId,
        entry_date: "2026-11-14",
        created_by: SYSTEM_ACTOR_ID,
      },
    ]);
    expect(await outboxState(eventId)).toEqual(PUBLISHED);
  });

  it.each(["RENEWAL", "RENEGOTIATION"])(
    "C14 (A2): originType %s writes nothing and the event is published",
    async (originType) => {
      const eventId = await emit("LoanActivated", loanActivated({ originLoanId: ORIGIN_LOAN, originType }));
      expect(await run()).toEqual({ published: 1, failed: 0 });
      expect(await entries()).toEqual([]);
      expect(await outboxState(eventId)).toEqual(PUBLISHED);
    },
  );

  it("C15 (A3): an IMPORT activation writes the DISBURSEMENT", async () => {
    await emit("LoanActivated", loanActivated({ originType: "IMPORT", principalCents: 120000 }));
    expect(await run()).toEqual({ published: 1, failed: 0 });
    expect(await summary()).toEqual([
      { type: "DISBURSEMENT", component: "PRINCIPAL", amount: -120000, date: "2026-11-14" },
    ]);
  });
});

describe("treasury-ledger: recebimento (E12-F01 C16 a C18, A4, A5)", () => {
  it("C16 (A4): one REPAYMENT per component with the sum over the allocations", async () => {
    const eventId = await emit(
      "PaymentConfirmed",
      paymentConfirmed(150000, [
        allocation(INSTALLMENT_1, 6000, 20000, 100000),
        allocation(INSTALLMENT_2, 4500, 19500, 0),
      ]),
    );
    expect(await run()).toEqual({ published: 1, failed: 0 });
    const rows = await entries();
    expect(rows.map((e) => [e.type, e.component, e.amount_cents])).toEqual([
      ["REPAYMENT", "INTEREST", 39500],
      ["REPAYMENT", "LATE_CHARGES", 10500],
      ["REPAYMENT", "PRINCIPAL", 100000],
    ]);
    expect(rows.every((e) => e.source_type === "PAYMENT" && e.source_id === PAYMENT)).toBe(true);
    expect(rows.every((e) => e.source_event_id === eventId && e.created_by === SYSTEM_ACTOR_ID)).toBe(true);
    expect(rows.every((e) => e.account_id === ACCOUNT && e.entry_date === "2026-11-10")).toBe(true);
    expect(await paymentSum()).toBe(150000);
  });

  it("C17 (A4): a component that sums to zero writes no line", async () => {
    await emit("PaymentConfirmed", paymentConfirmed(115000, [allocation(INSTALLMENT_1, 0, 31667, 83333)]));
    expect(await run()).toEqual({ published: 1, failed: 0 });
    expect(await summary()).toEqual([
      { type: "REPAYMENT", component: "INTEREST", amount: 31667, date: "2026-11-10" },
      { type: "REPAYMENT", component: "PRINCIPAL", amount: 83333, date: "2026-11-10" },
    ]);
  });

  it("C18 (A5): a recovery payment writes a single REPAYMENT RECOVERY of amountCents", async () => {
    await emit("PaymentConfirmed", paymentConfirmed(50000, [allocation(INSTALLMENT_1, 1000, 9000, 40000)], true));
    expect(await run()).toEqual({ published: 1, failed: 0 });
    const rows = await entries();
    expect(rows.map((e) => [e.type, e.component, e.amount_cents, e.source_type, e.source_id])).toEqual([
      ["REPAYMENT", "RECOVERY", 50000, "PAYMENT", PAYMENT],
    ]);
  });
});

describe("treasury-ledger: estorno (E12-F01 C19, C20, A6, A7)", () => {
  it("C19 (A6): a reversal mirrors every REPAYMENT, dated today in Brasília, and the payment sums to zero", async () => {
    const allocations = [allocation(INSTALLMENT_1, 6000, 20000, 100000), allocation(INSTALLMENT_2, 4500, 19500, 0)];
    await emit("PaymentConfirmed", paymentConfirmed(150000, allocations), "2026-11-20T12:00:00.000Z");
    const reversalId = await emit("PaymentReversed", paymentReversed(150000, allocations), "2026-11-20T13:00:00.000Z");
    expect(await run()).toEqual({ published: 2, failed: 0 });
    const reversals = (await entries()).filter((e) => e.type === "REVERSAL");
    expect(reversals.map((e) => [e.component, e.amount_cents, e.entry_date])).toEqual([
      ["INTEREST", -39500, TODAY_BRASILIA],
      ["LATE_CHARGES", -10500, TODAY_BRASILIA],
      ["PRINCIPAL", -100000, TODAY_BRASILIA],
    ]);
    expect(reversals.every((e) => e.source_type === "PAYMENT" && e.source_id === PAYMENT)).toBe(true);
    expect(reversals.every((e) => e.source_event_id === reversalId && e.account_id === ACCOUNT)).toBe(true);
    expect(reversals.every((e) => e.created_by === SYSTEM_ACTOR_ID)).toBe(true);
    expect(await paymentSum()).toBe(0);
  });

  it("C19 (A6): the reversal of a recovery payment mirrors the RECOVERY line", async () => {
    const allocations = [allocation(INSTALLMENT_1, 1000, 9000, 40000)];
    await emit("PaymentConfirmed", paymentConfirmed(50000, allocations, true), "2026-11-20T12:00:00.000Z");
    await emit("PaymentReversed", paymentReversed(50000, allocations), "2026-11-20T13:00:00.000Z");
    expect(await run()).toEqual({ published: 2, failed: 0 });
    expect(await summary()).toEqual([
      { type: "REPAYMENT", component: "RECOVERY", amount: 50000, date: "2026-11-10" },
      { type: "REVERSAL", component: "RECOVERY", amount: -50000, date: TODAY_BRASILIA },
    ]);
    expect(await paymentSum()).toBe(0);
  });

  it("C20 (A7): a reversal before its REPAYMENT fails and succeeds on a later run", async () => {
    const allocations = [allocation(INSTALLMENT_1, 0, 31667, 83333)];
    const reversalId = await emit("PaymentReversed", paymentReversed(115000, allocations), "2026-11-20T13:00:00.000Z");
    expect(await run()).toEqual({ published: 0, failed: 1 });
    expect(await entries()).toEqual([]);
    expect(await outboxState(reversalId)).toEqual({ published: false, attempts: 1, failed: true });
    expect(await processedBy("treasury-ledger")).toBe(0);

    await emit("PaymentConfirmed", paymentConfirmed(115000, allocations), "2026-11-20T12:00:00.000Z");
    expect(await run()).toEqual({ published: 2, failed: 0 });
    expect(await summary()).toEqual([
      { type: "REPAYMENT", component: "INTEREST", amount: 31667, date: "2026-11-10" },
      { type: "REPAYMENT", component: "PRINCIPAL", amount: 83333, date: "2026-11-10" },
      { type: "REVERSAL", component: "INTEREST", amount: -31667, date: TODAY_BRASILIA },
      { type: "REVERSAL", component: "PRINCIPAL", amount: -83333, date: TODAY_BRASILIA },
    ]);
    expect(await outboxState(reversalId)).toEqual({ published: true, attempts: 1, failed: true });
  });
});

describe("treasury-ledger: tipos ignorados e payload inválido (E12-F01 C21, C22, A8, A10)", () => {
  it("C21 (A8): subscribes exactly to LoanActivated, PaymentConfirmed and PaymentReversed", () => {
    expect(treasuryLedgerConsumer.name).toBe("treasury-ledger");
    expect([...treasuryLedgerConsumer.eventTypes].sort()).toEqual([
      "LoanActivated",
      "PaymentConfirmed",
      "PaymentReversed",
    ]);
  });

  it.each(["LoanWrittenOff", "LoanPaidOff", "LoanReopened", "InstallmentPaid", "SomethingUnknown"])(
    "C21 (A8): %s writes nothing and is published",
    async (type) => {
      const eventId = await emit(type, { loanId: LOAN });
      expect(await run()).toEqual({ published: 1, failed: 0 });
      expect(await entries()).toEqual([]);
      expect(await outboxState(eventId)).toEqual(PUBLISHED);
      expect(await processedBy("treasury-ledger")).toBe(0);
    },
  );

  const invalid: [string, string, unknown][] = [
    ["LoanActivated", "fractional principalCents", loanActivated({ principalCents: 1.5 })],
    ["LoanActivated", "principalCents as text", loanActivated({ principalCents: "500000" })],
    ["LoanActivated", "unknown originType", loanActivated({ originType: "MIGRATION" })],
    [
      "PaymentConfirmed",
      "allocations that do not sum to amountCents",
      paymentConfirmed(150000, [allocation(INSTALLMENT_1, 0, 31667, 83333)]),
    ],
    [
      "PaymentConfirmed",
      "missing accountId",
      { ...paymentConfirmed(115000, [allocation(INSTALLMENT_1, 0, 31667, 83333)]), accountId: undefined },
    ],
  ];

  it.each(invalid)("C22 (A10): invalid %s payload (%s) fails only that event", async (type, _label, payload) => {
    const badId = await emit(type, payload, "2026-11-20T12:00:00.000Z");
    const goodId = await emit("LoanActivated", loanActivated(), "2026-11-20T12:01:00.000Z");
    expect(await run()).toEqual({ published: 1, failed: 1 });
    expect(await outboxState(badId)).toEqual({ published: false, attempts: 1, failed: true });
    expect(await outboxState(goodId)).toEqual(PUBLISHED);
    expect((await entries()).map((e) => e.source_event_id)).toEqual([goodId]);
  });
});
