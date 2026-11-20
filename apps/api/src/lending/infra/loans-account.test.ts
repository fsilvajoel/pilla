import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { insertRow, testIds } from "../../db/table-contract";
import { migratedTestDb } from "../../db/test-db";

type Loan = { status: string; account_id: string | null };

// account_id anulável em DRAFT e CANCELLED (E10-F01, A5, C9 a C11): o check loans_account_id_check exige conta nos demais status.
describe("lending.loans account_id (loans_account_id_check)", () => {
  let client: PGlite;
  const id = testIds();
  let number = 0;
  const add = (fields: Record<string, unknown>) =>
    insertRow<Loan>(client, "lending.loans", {
      id: id(),
      loan_number: `2026-${String(++number).padStart(4, "0")}`,
      person_id: id(),
      type: "INSTALLMENT",
      principal_cents: 100000,
      monthly_interest_rate_bps: 1000,
      installment_count: 3,
      frequency_unit: "MONTH",
      frequency_interval: 1,
      first_due_date: "2026-12-16",
      contracted_at: "2026-11-16",
      late_fee_bps: 200,
      late_interest_monthly_bps: 100,
      grace_period_days: 0,
      rounding_step_cents: 500,
      ...fields,
    });
  beforeAll(async () => ({ client } = await migratedTestDb()));
  afterAll(async () => client.close());

  it("C9: stores a DRAFT loan with a null account_id", async () => {
    const { rows } = await add({ status: "DRAFT", account_id: null });
    expect(rows[0]).toMatchObject({ status: "DRAFT", account_id: null });
  });

  it("C10: stores a CANCELLED loan with a null account_id", async () => {
    const { rows } = await add({ status: "CANCELLED", account_id: null });
    expect(rows[0]).toMatchObject({ status: "CANCELLED", account_id: null });
  });

  it("C11: refuses an ACTIVE loan with a null account_id by loans_account_id_check", async () => {
    await expect(add({ status: "ACTIVE", disbursed_at: "2026-11-16", account_id: null })).rejects.toThrow(
      /loans_account_id_check/,
    );
  });

  it("still accepts an ACTIVE loan that has an account_id", async () => {
    const { rows } = await add({ status: "ACTIVE", disbursed_at: "2026-11-16", account_id: id() });
    expect(rows[0]).toMatchObject({ status: "ACTIVE" });
  });
});
