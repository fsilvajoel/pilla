import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { columnsOf, indexesOf, insertRow, testIds } from "../../db/table-contract";
import { migratedTestDb } from "../../db/test-db";

// Contrato em SQL (RFC-005 §4): condições padrão com histórico (vigente = maior effective_from) e a
// numeração anual dos contratos.
describe("lending.default_terms (RFC-005 §4)", () => {
  let client: PGlite;
  const id = testIds();
  const add = (fields: Record<string, unknown> = {}) =>
    insertRow<{ rounding_step_cents: number; created_at: Date | null }>(client, "lending.default_terms", {
      id: id(),
      late_fee_bps: 200,
      late_interest_monthly_bps: 100,
      grace_period_days: 3,
      suggested_monthly_rate_bps: 1000,
      effective_from: "2026-11-16T00:00:00Z",
      created_by: id(),
      ...fields,
    });
  beforeAll(async () => ({ client } = await migratedTestDb()));
  afterAll(async () => client.close());

  it("has exactly the columns of RFC-005 §4", async () => {
    expect(await columnsOf(client, "lending", "default_terms")).toEqual([
      "created_at timestamp with time zone not null default now()",
      "created_by uuid not null",
      "effective_from timestamp with time zone not null",
      "grace_period_days integer not null",
      "id uuid not null",
      "late_fee_bps integer not null",
      "late_interest_monthly_bps integer not null",
      "rounding_step_cents bigint not null default 500",
      "suggested_monthly_rate_bps integer not null",
    ]);
  });

  it("fills rounding_step_cents with 500 and created_at by default", async () => {
    const { rows } = await add();
    expect(rows[0]?.rounding_step_cents).toBe(500);
    expect(rows[0]?.created_at).toBeInstanceOf(Date);
  });

  it("keeps the history: many rows with different effective_from", async () => {
    const results = [
      await add({ effective_from: "2026-01-01T00:00:00Z" }),
      await add({ effective_from: "2026-06-01T00:00:00Z" }),
    ];
    expect(results.map((r) => r.affectedRows)).toEqual([1, 1]);
  });

  it.each([
    { field: "late_fee_bps", value: -1 },
    { field: "late_interest_monthly_bps", value: -1 },
    { field: "grace_period_days", value: -1 },
    { field: "suggested_monthly_rate_bps", value: -1 },
    { field: "rounding_step_cents", value: 0 },
  ])("refuses $field = $value", async ({ field, value }) => {
    await expect(add({ [field]: value })).rejects.toThrow(/check constraint/);
  });

  it("has an index on effective_from to find the current terms", async () => {
    expect(await indexesOf(client, "lending", "default_terms")).toEqual([
      "CREATE INDEX default_terms_effective_from_idx ON lending.default_terms USING btree (effective_from)",
      "CREATE UNIQUE INDEX default_terms_pkey ON lending.default_terms USING btree (id)",
    ]);
  });
});

describe("lending.loan_number_sequences (RFC-005 §4)", () => {
  let client: PGlite;
  beforeAll(async () => ({ client } = await migratedTestDb()));
  afterAll(async () => client.close());

  it("has exactly the columns of RFC-005 §4", async () => {
    expect(await columnsOf(client, "lending", "loan_number_sequences")).toEqual([
      "last_value integer not null default 0",
      "year integer not null",
    ]);
  });

  it("starts a year at 0 and keeps one row per year", async () => {
    const { rows } = await insertRow<{ last_value: number }>(client, "lending.loan_number_sequences", { year: 2026 });
    expect(rows[0]?.last_value).toBe(0);
    await expect(insertRow(client, "lending.loan_number_sequences", { year: 2026 })).rejects.toThrow(
      /unique constraint/,
    );
  });

  it("refuses a negative last_value", async () => {
    await expect(insertRow(client, "lending.loan_number_sequences", { year: 2027, last_value: -1 })).rejects.toThrow(
      /check constraint/,
    );
  });
});
