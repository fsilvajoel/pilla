import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { migratedTestDb, type MigratedTestDb } from "../../db/test-db";
import { confirmedAllocationsByLoan, confirmedAllocationsByLoans } from "./confirmed-allocations";

// D6 (E12-F04): leitura agregada das alocações de vários contratos, no lugar de uma consulta por contrato.
const id = (n: number): string => `01970000-0000-7000-8000-${String(n).padStart(12, "0")}`;
const LOAN_A = id(1);
const LOAN_B = id(2);
const LOAN_C = id(3);
const INST_A = id(11);
const INST_B1 = id(12);
const INST_B2 = id(13);
const PERSON = id(21);
const ACCOUNT = id(22);
const USER = id(23);

let handle: MigratedTestDb;
let client: PGlite;
let seq = 100;

beforeAll(async () => {
  handle = await migratedTestDb();
  client = handle.client;
});
afterAll(async () => handle.close());
beforeEach(async () => {
  await client.query("delete from payments.payment_allocations");
  await client.query("delete from payments.payments");
});

async function add(
  loanId: string,
  installmentId: string,
  status: string,
  principal: number,
  paidAt = "2026-11-16",
): Promise<void> {
  const paymentId = id(++seq);
  await client.query(
    `insert into payments.payments (id, loan_id, person_id, account_id, paid_at, amount_cents, method, channel, status, created_by)
     values ($1, $2, $3, $4, $7, 1000, 'CASH', 'ADMIN', $5, $6)`,
    [paymentId, loanId, PERSON, ACCOUNT, status, USER, paidAt],
  );
  await client.query(
    `insert into payments.payment_allocations
       (id, payment_id, loan_id, installment_id, late_charges_cents, interest_cents, principal_cents)
     values ($1, $2, $3, $4, 1, 2, $5)`,
    [id(++seq), paymentId, loanId, installmentId, principal],
  );
}

describe("payments public: confirmedAllocationsByLoans", () => {
  it("groups by loan, matches the one-loan read and leaves out loans with nothing confirmed", async () => {
    await add(LOAN_A, INST_A, "CONFIRMED", 100);
    await add(LOAN_B, INST_B1, "CONFIRMED", 200, "2026-11-10");
    await add(LOAN_B, INST_B1, "CONFIRMED", 50, "2026-11-12");
    await add(LOAN_B, INST_B2, "CONFIRMED", 70);
    await add(LOAN_C, id(14), "PENDING_REVIEW", 999);
    const many = await confirmedAllocationsByLoans(handle.db, [LOAN_A, LOAN_B, LOAN_C]);
    expect([...many.keys()].sort()).toEqual([LOAN_A, LOAN_B]);
    expect(many.get(LOAN_A)).toEqual(await confirmedAllocationsByLoan(handle.db, LOAN_A));
    expect(many.get(LOAN_B)).toEqual(await confirmedAllocationsByLoan(handle.db, LOAN_B));
    expect(many.get(LOAN_B)?.find((a) => a.installmentId === INST_B1)).toMatchObject({
      principalCents: 250,
      payments: [{ paidAt: "2026-11-10" }, { paidAt: "2026-11-12" }],
    });
  });

  it("answers an empty map for an empty list", async () => {
    expect((await confirmedAllocationsByLoans(handle.db, [])).size).toBe(0);
  });
});
