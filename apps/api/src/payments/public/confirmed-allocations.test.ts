import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { migratedTestDb, type MigratedTestDb } from "../../db/test-db";
import { confirmedAllocationsByLoan } from "./confirmed-allocations";

const LOAN_ID = "01970000-0000-7000-8000-0000000000a1";
const OTHER_LOAN_ID = "01970000-0000-7000-8000-0000000000a2";
const INSTALLMENT_1 = "01970000-0000-7000-8000-0000000000b1";
const INSTALLMENT_2 = "01970000-0000-7000-8000-0000000000b2";
const PERSON_ID = "01970000-0000-7000-8000-0000000000c1";
const ACCOUNT_ID = "01970000-0000-7000-8000-0000000000c2";
const USER_ID = "01970000-0000-7000-8000-0000000000c3";

let handle: MigratedTestDb;
let client: PGlite;
let seq = 0;
const nextId = (): string => `01970000-0000-7000-8000-${String(++seq).padStart(12, "0")}`;

beforeAll(async () => {
  handle = await migratedTestDb();
  client = handle.client;
});
afterAll(async () => handle.close());
beforeEach(async () => {
  await client.query("delete from payments.payment_allocations");
  await client.query("delete from payments.payments");
});

type Alloc = { principal: number; interest: number; lateCharges: number; reversedAt?: string | null };

const PAID_AT = "2026-11-16";

async function addPayment(
  loanId: string,
  status: string,
  allocations: Record<string, Alloc>,
  paidAt: string = PAID_AT,
): Promise<void> {
  const paymentId = nextId();
  await client.query(
    `insert into payments.payments (id, loan_id, person_id, account_id, paid_at, amount_cents, method, channel, status, created_by)
     values ($1, $2, $3, $4, $7, 1000, 'CASH', 'ADMIN', $5, $6)`,
    [paymentId, loanId, PERSON_ID, ACCOUNT_ID, status, USER_ID, paidAt],
  );
  for (const [installmentId, a] of Object.entries(allocations)) {
    await client.query(
      `insert into payments.payment_allocations
         (id, payment_id, loan_id, installment_id, late_charges_cents, interest_cents, principal_cents, reversed_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [nextId(), paymentId, loanId, installmentId, a.lateCharges, a.interest, a.principal, a.reversedAt ?? null],
    );
  }
}

describe("payments public: confirmedAllocationsByLoan", () => {
  it("C8: sums the allocations of a CONFIRMED payment by component", async () => {
    await addPayment(LOAN_ID, "CONFIRMED", { [INSTALLMENT_1]: { principal: 300, interest: 100, lateCharges: 20 } });
    expect(await confirmedAllocationsByLoan(handle.db, LOAN_ID)).toEqual([
      {
        installmentId: INSTALLMENT_1,
        principalCents: 300,
        interestCents: 100,
        lateChargesCents: 20,
        payments: [{ paidAt: PAID_AT, principalCents: 300, interestCents: 100, lateChargesCents: 20 }],
      },
    ]);
  });

  it("C9: ignores a PENDING_REVIEW payment", async () => {
    await addPayment(LOAN_ID, "PENDING_REVIEW", { [INSTALLMENT_1]: { principal: 300, interest: 100, lateCharges: 0 } });
    expect(await confirmedAllocationsByLoan(handle.db, LOAN_ID)).toEqual([]);
  });

  it("C10: ignores a REVERSED payment and an allocation with reversed_at", async () => {
    await addPayment(LOAN_ID, "REVERSED", { [INSTALLMENT_1]: { principal: 300, interest: 100, lateCharges: 0 } });
    await addPayment(LOAN_ID, "CONFIRMED", {
      [INSTALLMENT_2]: { principal: 50, interest: 5, lateCharges: 0, reversedAt: "2026-11-17T10:00:00Z" },
    });
    expect(await confirmedAllocationsByLoan(handle.db, LOAN_ID)).toEqual([]);
  });

  it("C11: groups two installments and adds two payments on the same installment", async () => {
    await addPayment(LOAN_ID, "CONFIRMED", {
      [INSTALLMENT_1]: { principal: 300, interest: 100, lateCharges: 0 },
      [INSTALLMENT_2]: { principal: 200, interest: 40, lateCharges: 10 },
    });
    await addPayment(LOAN_ID, "CONFIRMED", { [INSTALLMENT_1]: { principal: 100, interest: 20, lateCharges: 5 } });
    await addPayment(OTHER_LOAN_ID, "CONFIRMED", {
      [INSTALLMENT_1]: { principal: 999, interest: 999, lateCharges: 999 },
    });
    const result = await confirmedAllocationsByLoan(handle.db, LOAN_ID);
    expect([...result].sort((a, b) => a.installmentId.localeCompare(b.installmentId))).toEqual([
      {
        installmentId: INSTALLMENT_1,
        principalCents: 400,
        interestCents: 120,
        lateChargesCents: 5,
        payments: [
          { paidAt: PAID_AT, principalCents: 300, interestCents: 100, lateChargesCents: 0 },
          { paidAt: PAID_AT, principalCents: 100, interestCents: 20, lateChargesCents: 5 },
        ],
      },
      {
        installmentId: INSTALLMENT_2,
        principalCents: 200,
        interestCents: 40,
        lateChargesCents: 10,
        payments: [{ paidAt: PAID_AT, principalCents: 200, interestCents: 40, lateChargesCents: 10 }],
      },
    ]);
  });

  it("C12: lists the confirmed payments of each installment by paidAt, whatever the order they were saved in", async () => {
    await addPayment(
      LOAN_ID,
      "CONFIRMED",
      { [INSTALLMENT_1]: { principal: 100, interest: 20, lateCharges: 5 } },
      "2026-11-20",
    );
    await addPayment(
      LOAN_ID,
      "CONFIRMED",
      { [INSTALLMENT_1]: { principal: 300, interest: 100, lateCharges: 0 } },
      "2026-11-10",
    );
    const result = await confirmedAllocationsByLoan(handle.db, LOAN_ID);
    expect(result).toEqual([
      {
        installmentId: INSTALLMENT_1,
        principalCents: 400,
        interestCents: 120,
        lateChargesCents: 5,
        payments: [
          { paidAt: "2026-11-10", principalCents: 300, interestCents: 100, lateChargesCents: 0 },
          { paidAt: "2026-11-20", principalCents: 100, interestCents: 20, lateChargesCents: 5 },
        ],
      },
    ]);
  });

  it("C13: a reversed payment and a reversed allocation leave the history of the installment", async () => {
    await addPayment(
      LOAN_ID,
      "REVERSED",
      { [INSTALLMENT_1]: { principal: 999, interest: 99, lateCharges: 9 } },
      "2026-11-05",
    );
    await addPayment(
      LOAN_ID,
      "CONFIRMED",
      { [INSTALLMENT_1]: { principal: 888, interest: 88, lateCharges: 8, reversedAt: "2026-11-18T10:00:00Z" } },
      "2026-11-06",
    );
    await addPayment(
      LOAN_ID,
      "CONFIRMED",
      { [INSTALLMENT_1]: { principal: 300, interest: 100, lateCharges: 20 } },
      "2026-11-12",
    );
    const result = await confirmedAllocationsByLoan(handle.db, LOAN_ID);
    expect(result).toEqual([
      {
        installmentId: INSTALLMENT_1,
        principalCents: 300,
        interestCents: 100,
        lateChargesCents: 20,
        payments: [{ paidAt: "2026-11-12", principalCents: 300, interestCents: 100, lateChargesCents: 20 }],
      },
    ]);
  });
});
