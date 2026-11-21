import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { migratedTestDb, type MigratedTestDb } from "../../db/test-db";
import { findLoanNumbers, loadLoanForPayment } from "./loan-for-payment";

const LOAN = "01970000-0000-7000-8000-0000000000a1";
const OTHER = "01970000-0000-7000-8000-0000000000a2";
const SUCCESSOR = "01970000-0000-7000-8000-0000000000a3";
const PERSON = "01970000-0000-7000-8000-0000000000c1";

let handle: MigratedTestDb;
let client: PGlite;

beforeAll(async () => {
  handle = await migratedTestDb();
  client = handle.client;
});
afterAll(async () => handle.close());
beforeEach(async () => {
  await client.query("delete from lending.installments");
  await client.query("delete from lending.loans");
});

async function seedLoan(id: string, number: string, status: string, origin: string | null): Promise<void> {
  await client.query(
    `insert into lending.loans
       (id, loan_number, person_id, type, status, principal_cents, monthly_interest_rate_bps, installment_count,
        frequency_unit, frequency_interval, first_due_date, contracted_at, origin_loan_id, origin_type,
        late_fee_bps, late_interest_monthly_bps, grace_period_days, rounding_step_cents)
     values ($1, $2, $3, 'INSTALLMENT', $4, 100000, 500, 2, 'MONTH', 1, '2026-09-20', '2026-08-15',
        $5, $6, 250, 120, 3, 500)`,
    [id, number, PERSON, status, origin, origin === null ? null : "RENEWAL"],
  );
}

describe("loadLoanForPayment (E11-F01, D3)", () => {
  it("returns plain data: status, terms, installments in order and the successor", async () => {
    await seedLoan(LOAN, "2026-0001", "DRAFT", null);
    await seedLoan(SUCCESSOR, "2026-0002", "DRAFT", LOAN);
    for (const [index, id] of [
      "01970000-0000-7000-8000-0000000000b2",
      "01970000-0000-7000-8000-0000000000b1",
    ].entries()) {
      await client.query(
        `insert into lending.installments (id, loan_id, number, due_date, principal_cents, interest_cents, total_cents)
         values ($1, $2, $3, $4, 40000, 10000, 50000)`,
        [id, LOAN, 2 - index, index === 0 ? "2026-10-20" : "2026-09-20"],
      );
    }
    const loan = await loadLoanForPayment(handle.db, LOAN);
    expect(loan).toMatchObject({
      id: LOAN,
      loanNumber: "2026-0001",
      personId: PERSON,
      status: "DRAFT",
      accountId: null,
      disbursedAt: null,
      successorLoanId: SUCCESSOR,
    });
    expect(loan?.lateTerms).toEqual({
      finePercent: 250n,
      lateInterestMonthlyRate: 120n,
      graceDays: 3,
      roundingStep: 500n,
    });
    expect(loan?.installments.map((installment) => installment.number)).toEqual([1, 2]);
    expect(loan?.installments[0]).toEqual({
      id: "01970000-0000-7000-8000-0000000000b1",
      number: 1,
      dueDate: "2026-09-20",
      principalCents: 40000,
      interestCents: 10000,
    });
  });

  it("answers null for an unknown loan, with or without the row lock", async () => {
    expect(await loadLoanForPayment(handle.db, OTHER)).toBeNull();
    expect(await loadLoanForPayment(handle.db, OTHER, { forUpdate: true })).toBeNull();
  });

  it("reads with the row lock inside a transaction and has no successor when none points at it", async () => {
    await seedLoan(LOAN, "2026-0001", "DRAFT", null);
    const loan = await handle.db.transaction((tx) => loadLoanForPayment(tx, LOAN, { forUpdate: true }));
    expect(loan?.id).toBe(LOAN);
    expect(loan?.successorLoanId).toBeNull();
  });
});

describe("findLoanNumbers (E11-F01, D3)", () => {
  it("maps each known id to its number and leaves unknown ids out", async () => {
    await seedLoan(LOAN, "2026-0001", "DRAFT", null);
    await seedLoan(SUCCESSOR, "2026-0002", "DRAFT", LOAN);
    const numbers = await findLoanNumbers(handle.db, [LOAN, SUCCESSOR, OTHER]);
    expect([...numbers.entries()].sort()).toEqual([
      [LOAN, "2026-0001"],
      [SUCCESSOR, "2026-0002"],
    ]);
  });

  it("answers an empty map for no ids", async () => {
    expect((await findLoanNumbers(handle.db, [])).size).toBe(0);
  });
});
