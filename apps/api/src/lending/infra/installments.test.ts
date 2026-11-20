import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { columnsOf, indexesOf, insertRow, testIds } from "../../db/table-contract";
import { migratedTestDb } from "../../db/test-db";

// Contrato da tabela em SQL (RFC-005 §4): parcela gerada na ativação, com total = principal + juros.
describe("lending.installments (RFC-005 §4)", () => {
  let client: PGlite;
  const id = testIds();
  let loanId = "";
  const add = (fields: Record<string, unknown> = {}) =>
    insertRow<{ created_at: Date | null }>(client, "lending.installments", {
      id: id(),
      loan_id: loanId,
      number: 1,
      due_date: "2026-12-16",
      principal_cents: 33500,
      interest_cents: 10000,
      total_cents: 43500,
      ...fields,
    });
  beforeAll(async () => {
    ({ client } = await migratedTestDb());
    loanId = id();
    await insertRow(client, "lending.loans", {
      id: loanId,
      loan_number: "2026-0001",
      person_id: id(),
      type: "INSTALLMENT",
      status: "DRAFT",
      principal_cents: 100000,
      monthly_interest_rate_bps: 1000,
      installment_count: 3,
      frequency_unit: "MONTH",
      frequency_interval: 1,
      first_due_date: "2026-12-16",
      contracted_at: "2026-11-16",
      account_id: id(),
      late_fee_bps: 200,
      late_interest_monthly_bps: 100,
      grace_period_days: 0,
      rounding_step_cents: 500,
    });
  });
  afterAll(async () => client.close());

  it("has exactly the columns of RFC-005 §4", async () => {
    expect(await columnsOf(client, "lending", "installments")).toEqual([
      "created_at timestamp with time zone not null default now()",
      "due_date date not null",
      "id uuid not null",
      "interest_cents bigint not null",
      "loan_id uuid not null",
      "number integer not null",
      "principal_cents bigint not null",
      "total_cents bigint not null",
    ]);
  });

  it("fills created_at by default", async () => {
    const { rows } = await add({ number: 10 });
    expect(rows[0]?.created_at).toBeInstanceOf(Date);
  });

  it("accepts an installment with only interest (INTEREST_ONLY, RFC-002 §3.4)", async () => {
    const r = await add({ number: 11, principal_cents: 0, interest_cents: 10000, total_cents: 10000 });
    expect(r.affectedRows).toBe(1);
  });

  it("refuses a total that is not principal plus interest", async () => {
    await expect(add({ number: 12, total_cents: 43501 })).rejects.toThrow(/check constraint/);
  });

  it("refuses a repeated number in the same loan", async () => {
    await add({ number: 13 });
    await expect(add({ number: 13 })).rejects.toThrow(/unique constraint/);
  });

  it.each([
    { field: "number", value: 0 },
    { field: "principal_cents", value: -1 },
    { field: "interest_cents", value: -1 },
  ])("refuses $field = $value", async ({ field, value }) => {
    await expect(add({ number: 20, [field]: value })).rejects.toThrow(/check constraint/);
  });

  it("refuses a loan that does not exist", async () => {
    await expect(add({ number: 21, loan_id: "01970000-0000-7000-8000-ffffffffffff" })).rejects.toThrow(
      /foreign key constraint/,
    );
  });

  it("has the indexes of RFC-005 §4", async () => {
    expect(await indexesOf(client, "lending", "installments")).toEqual([
      "CREATE INDEX installments_due_date_idx ON lending.installments USING btree (due_date)",
      "CREATE UNIQUE INDEX installments_loan_id_number_key ON lending.installments USING btree (loan_id, number)",
      "CREATE UNIQUE INDEX installments_pkey ON lending.installments USING btree (id)",
    ]);
  });
});
