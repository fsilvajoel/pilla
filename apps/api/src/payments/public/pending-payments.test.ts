import type { PGlite } from "@electric-sql/pglite";
import { pendingPaymentsSummarySchema } from "@pilla/schemas";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { migratedTestDb, type MigratedTestDb } from "../../db/test-db";
import { listPendingReviewPayments } from "./pending-payments";

const uuid = (n: number): string => `01970000-0000-7000-8000-${String(1000000000000 + n).slice(1)}`;
const LOAN = uuid(11);
const PERSON = uuid(1);
const ACCOUNT = uuid(3);
const USER = uuid(4);

let handle: MigratedTestDb;
let client: PGlite;

beforeAll(async () => {
  handle = await migratedTestDb();
  client = handle.client;
});
afterAll(async () => handle.close());
beforeEach(async () => {
  await client.query("delete from payments.payments");
});

async function add(
  id: string,
  status: string,
  createdAt: string,
  amountCents = 1000,
  extra: { method?: string; paidAt?: string; loanId?: string } = {},
): Promise<void> {
  await client.query(
    `insert into payments.payments
       (id, loan_id, person_id, account_id, paid_at, amount_cents, method, channel, status, created_at, created_by)
     values ($1, $2, $3, $4, $5, $6, $7, 'ADMIN', $8, $9, $10)`,
    [
      id,
      extra.loanId ?? LOAN,
      PERSON,
      ACCOUNT,
      extra.paidAt ?? "2026-11-20",
      amountCents,
      extra.method ?? "PIX",
      status,
      createdAt,
      USER,
    ],
  );
}

/** Insere `total` pendentes de 100 centavos, um por minuto, com ids crescentes. */
async function addMany(total: number): Promise<void> {
  await client.query(
    `insert into payments.payments
       (id, loan_id, person_id, account_id, paid_at, amount_cents, method, channel, status, created_at, created_by)
     select ('01970000-0000-7000-8000-' || lpad((5000 + i)::text, 12, '0'))::uuid, $1, $2, $3, '2026-11-20', 100,
            'PIX', 'ADMIN', 'PENDING_REVIEW', timestamptz '2026-11-01 00:00:00+00' + (i || ' minutes')::interval, $4
       from generate_series(1, $5::int) as i`,
    [LOAN, PERSON, ACCOUNT, USER, total],
  );
}

describe("payments public: listPendingReviewPayments (E11-F02, contrato da E13)", () => {
  it("C23 (A17): returns only PENDING_REVIEW rows, whatever the loan", async () => {
    await add(uuid(201), "PENDING_REVIEW", "2026-11-01T10:00:00Z");
    await add(uuid(202), "CONFIRMED", "2026-11-02T10:00:00Z");
    await add(uuid(203), "REVERSED", "2026-11-03T10:00:00Z");
    await add(uuid(204), "PENDING_REVIEW", "2026-11-04T10:00:00Z", 2000, { loanId: uuid(12) });
    const result = await listPendingReviewPayments(handle.db);
    expect(result.items.map((item) => item.id)).toEqual([uuid(201), uuid(204)]);
    expect(result.count).toBe(2);
    expect(result.totalCents).toBe(3000);
  });

  it("C23 (A17): an empty queue is count 0, total 0 and no items", async () => {
    await add(uuid(201), "CONFIRMED", "2026-11-02T10:00:00Z");
    expect(await listPendingReviewPayments(handle.db)).toEqual({ count: 0, totalCents: 0, items: [] });
  });

  it("C24 (A17): goes from the oldest to the newest, ties by id", async () => {
    await add(uuid(203), "PENDING_REVIEW", "2026-11-02T10:00:00Z");
    await add(uuid(202), "PENDING_REVIEW", "2026-11-01T10:00:00Z");
    await add(uuid(201), "PENDING_REVIEW", "2026-11-01T10:00:00Z");
    await add(uuid(204), "PENDING_REVIEW", "2026-11-03T10:00:00Z");
    const result = await listPendingReviewPayments(handle.db);
    expect(result.items.map((item) => item.id)).toEqual([uuid(201), uuid(202), uuid(203), uuid(204)]);
  });

  it("C27 (A19): each item is the contract of the E13: ids, values and registeredAt, nothing else", async () => {
    await add(uuid(201), "PENDING_REVIEW", "2026-11-01T10:00:00Z", 115000, { method: "BOLETO", paidAt: "2026-10-30" });
    const result = await listPendingReviewPayments(handle.db);
    expect(pendingPaymentsSummarySchema.safeParse(result).success).toBe(true);
    const [item] = result.items;
    expect(Object.keys(item ?? {}).sort()).toEqual([
      "accountId",
      "amountCents",
      "id",
      "loanId",
      "method",
      "paidAt",
      "personId",
      "registeredAt",
    ]);
    expect(item).toMatchObject({
      id: uuid(201),
      loanId: LOAN,
      personId: PERSON,
      accountId: ACCOUNT,
      paidAt: "2026-10-30",
      amountCents: 115000,
      method: "BOLETO",
    });
    expect(new Date(item?.registeredAt ?? "").toISOString()).toBe("2026-11-01T10:00:00.000Z");
  });

  it("C27 (A19): returns plain objects, not Drizzle rows", async () => {
    await add(uuid(201), "PENDING_REVIEW", "2026-11-01T10:00:00Z");
    const result = await listPendingReviewPayments(handle.db);
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect(Object.getPrototypeOf(result.items[0])).toBe(Object.prototype);
    expect(typeof result.items[0]?.amountCents).toBe("number");
    expect(typeof result.totalCents).toBe("number");
  });

  it("C25 (A18): count and totalCents cover every pending row, not only the page", async () => {
    await addMany(5);
    const result = await listPendingReviewPayments(handle.db, { limit: 2 });
    expect(result.items).toHaveLength(2);
    expect(result.count).toBe(5);
    expect(result.totalCents).toBe(500);
  });

  it("C26 (A19): the default limit is 50 and the largest is 200", async () => {
    await addMany(205);
    const standard = await listPendingReviewPayments(handle.db);
    expect(standard.items).toHaveLength(50);
    expect(standard.count).toBe(205);
    expect(standard.totalCents).toBe(20500);
    expect((await listPendingReviewPayments(handle.db, { limit: 500 })).items).toHaveLength(200);
    expect((await listPendingReviewPayments(handle.db, { limit: 200 })).items).toHaveLength(200);
    expect((await listPendingReviewPayments(handle.db, { limit: 3 })).items).toHaveLength(3);
    expect((await listPendingReviewPayments(handle.db, {})).items).toHaveLength(50);
  });

  it("C27 (A19): is a pure read: nothing is written", async () => {
    await addMany(3);
    const before = await client.query<{ n: string }>("select count(*)::text as n from payments.payments");
    await listPendingReviewPayments(handle.db);
    const after = await client.query<{ n: string }>("select count(*)::text as n from payments.payments");
    expect(after.rows).toEqual(before.rows);
    const audit = await client.query<{ n: string }>("select count(*)::text as n from core.audit_log");
    expect(audit.rows).toEqual([{ n: "0" }]);
  });
});
