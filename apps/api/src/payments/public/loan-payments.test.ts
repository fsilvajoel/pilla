import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Database } from "../../db/database";
import { migratedTestDb } from "../../db/test-db";
import { confirmedPaymentsOfLoan } from "./loan-payments";

// Pagamentos que o cliente vê (RF-62, E15 D9): só CONFIRMED não estornados, mais antigos primeiro, três campos.
const uuid = (n: number): string => `01970000-0000-7000-8000-${String(1000000000000 + n).slice(1)}`;
const LOAN = uuid(1);
const OTHER_LOAN = uuid(2);
const PERSON = uuid(3);
const ACCOUNT = uuid(4);
const USER = uuid(5);

let client: PGlite;
let db: Database;
let counter = 100;

type Seed = {
  loanId?: string;
  paidAt?: string;
  amountCents?: number;
  method?: string;
  status?: string;
  reversedAt?: string | null;
  id?: string;
};
async function seed(payment: Seed): Promise<string> {
  const id = payment.id ?? uuid(++counter);
  await client.query(
    `insert into payments.payments
       (id, loan_id, person_id, account_id, paid_at, amount_cents, method, channel, status, reversed_at, created_by,
        pix_end_to_end_id)
     values ($1, $2, $3, $4, $5, $6, $7, 'ADMIN', $8, $9, $10, $11)`,
    [
      id,
      payment.loanId ?? LOAN,
      PERSON,
      ACCOUNT,
      payment.paidAt ?? "2026-11-01",
      payment.amountCents ?? 1000,
      payment.method ?? "PIX",
      payment.status ?? "CONFIRMED",
      payment.reversedAt ?? null,
      USER,
      `E2E-${id}`,
    ],
  );
  return id;
}

beforeAll(async () => {
  const migrated = await migratedTestDb();
  client = migrated.client;
  db = migrated.db;
});
afterAll(async () => client.close());
beforeEach(async () => {
  await client.query("delete from payments.payments");
});

describe("confirmedPaymentsOfLoan", () => {
  it("C16: returns a loan with no payment as an empty list", async () => {
    expect(await confirmedPaymentsOfLoan(db, LOAN)).toEqual([]);
  });

  it("C16: returns paidAt, amountCents and method of a confirmed payment, and nothing else", async () => {
    await seed({ paidAt: "2026-11-05", amountCents: 12345, method: "BOLETO" });
    expect(await confirmedPaymentsOfLoan(db, LOAN)).toEqual([
      { paidAt: "2026-11-05", amountCents: 12345, method: "BOLETO" },
    ]);
  });

  it.each(["PENDING_REVIEW", "REJECTED"])("C17: a %s payment never shows", async (status) => {
    await seed({ status });
    expect(await confirmedPaymentsOfLoan(db, LOAN)).toEqual([]);
  });

  it("C17: a REVERSED payment never shows", async () => {
    await seed({ status: "REVERSED", reversedAt: "2026-11-06T10:00:00Z" });
    expect(await confirmedPaymentsOfLoan(db, LOAN)).toEqual([]);
  });

  it("C17: a CONFIRMED payment with reversed_at set never shows", async () => {
    await seed({ status: "CONFIRMED", reversedAt: "2026-11-06T10:00:00Z" });
    expect(await confirmedPaymentsOfLoan(db, LOAN)).toEqual([]);
  });

  it("C17: only the payments of the asked loan show", async () => {
    await seed({ loanId: OTHER_LOAN, amountCents: 999 });
    await seed({ amountCents: 111 });
    expect((await confirmedPaymentsOfLoan(db, LOAN)).map((payment) => payment.amountCents)).toEqual([111]);
  });

  it("C18: orders by paidAt, oldest first, and by id on the same day", async () => {
    await seed({ paidAt: "2026-11-10", amountCents: 3 });
    await seed({ paidAt: "2026-11-01", amountCents: 1 });
    await seed({ paidAt: "2026-11-05", amountCents: 2, id: uuid(900) });
    await seed({ paidAt: "2026-11-05", amountCents: 20, id: uuid(800) });
    expect((await confirmedPaymentsOfLoan(db, LOAN)).map((payment) => payment.amountCents)).toEqual([1, 20, 2, 3]);
  });

  it("C18: keeps every payment method", async () => {
    for (const method of ["PIX", "BOLETO", "CASH", "BANK_TRANSFER"]) await seed({ method });
    expect((await confirmedPaymentsOfLoan(db, LOAN)).map((payment) => payment.method).sort()).toEqual([
      "BANK_TRANSFER",
      "BOLETO",
      "CASH",
      "PIX",
    ]);
  });

  it("C18: no payment id, account id or Pix id comes out", async () => {
    await seed({});
    const dump = JSON.stringify(await confirmedPaymentsOfLoan(db, LOAN));
    expect(dump).not.toContain(ACCOUNT);
    expect(dump).not.toContain("E2E-");
    expect(dump).not.toContain("01970000");
  });
});
