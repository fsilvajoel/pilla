import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { columnsOf, indexesOf, insertRow, testIds } from "../../db/table-contract";
import { migratedTestDb } from "../../db/test-db";

// Contrato da tabela em SQL (RFC-005 §4, ADR-0008): o teste não depende dos nomes TypeScript do schema.ts.
type Loan = {
  capitalized_amount_cents: number;
  version: number;
  status_changed_at: Date | null;
  created_at: Date | null;
  updated_at: Date | null;
};

describe("lending.loans (RFC-005 §4)", () => {
  let client: PGlite;
  const id = testIds();
  let number = 0;
  const add = (fields: Record<string, unknown> = {}) =>
    insertRow<Loan>(client, "lending.loans", {
      id: id(),
      loan_number: `2026-${String(++number).padStart(4, "0")}`,
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
      ...fields,
    });
  beforeAll(async () => ({ client } = await migratedTestDb()));
  afterAll(async () => client.close());

  it("has exactly the columns of RFC-005 §4", async () => {
    expect(await columnsOf(client, "lending", "loans")).toEqual([
      "account_id uuid not null",
      "capitalized_amount_cents bigint not null default 0",
      "contracted_at date not null",
      "created_at timestamp with time zone not null default now()",
      "disbursed_at date null",
      "first_due_date date not null",
      "frequency_interval integer not null",
      "frequency_unit text not null",
      "grace_period_days integer not null",
      "id uuid not null",
      "installment_count integer null",
      "internal_notes text null",
      "late_fee_bps integer not null",
      "late_interest_monthly_bps integer not null",
      "loan_number text not null",
      "monthly_interest_rate_bps integer not null",
      "origin_loan_id uuid null",
      "origin_type text null",
      "person_id uuid not null",
      "principal_cents bigint not null",
      "rounding_step_cents bigint not null",
      "status text not null",
      "status_changed_at timestamp with time zone not null default now()",
      "type text not null",
      "updated_at timestamp with time zone not null default now()",
      "version integer not null default 1",
      "write_off_reason text null",
    ]);
  });

  it("fills capitalized_amount_cents, version and the instants by default", async () => {
    const { rows } = await add();
    expect(rows[0]).toMatchObject({ capitalized_amount_cents: 0, version: 1 });
    expect(rows[0]?.status_changed_at).toBeInstanceOf(Date);
    expect(rows[0]?.created_at).toBeInstanceOf(Date);
    expect(rows[0]?.updated_at).toBeInstanceOf(Date);
  });

  it("refuses a repeated loan_number", async () => {
    await add({ loan_number: "2025-0001" });
    await expect(add({ loan_number: "2025-0001" })).rejects.toThrow(/unique constraint/);
  });

  it.each(["2026-1", "26-0001", "2026/0001", "2026-00a1"])("refuses the loan_number %s (AAAA-NNNN)", async (n) => {
    await expect(add({ loan_number: n })).rejects.toThrow(/check constraint/);
  });

  it.each(["INSTALLMENT", "SINGLE_PAYMENT", "CUSTOM"])("accepts the type %s", async (type) => {
    expect((await add({ type })).affectedRows).toBe(1);
  });

  it.each(["DRAFT", "CANCELLED"])("accepts the status %s without disbursed_at", async (status) => {
    expect((await add({ status })).affectedRows).toBe(1);
  });

  it.each(["ACTIVE", "PAID_OFF", "RENEWED", "RENEGOTIATED", "WRITTEN_OFF"])(
    "requires disbursed_at in the status %s",
    async (status) => {
      await expect(add({ status })).rejects.toThrow(/check constraint/);
      expect((await add({ status, disbursed_at: "2026-11-16" })).affectedRows).toBe(1);
    },
  );

  it("accepts an INTEREST_ONLY loan without installment_count", async () => {
    expect((await add({ type: "INTEREST_ONLY", installment_count: null })).affectedRows).toBe(1);
  });

  it.each(["INSTALLMENT", "SINGLE_PAYMENT", "CUSTOM"])("requires installment_count in the type %s", async (type) => {
    await expect(add({ type, installment_count: null })).rejects.toThrow(/check constraint/);
  });

  it.each([
    { field: "type", value: "LEASING" },
    { field: "status", value: "OPEN" },
    { field: "frequency_unit", value: "WEEK" },
    { field: "origin_type", value: "MIGRATION" },
    { field: "principal_cents", value: 0 },
    { field: "monthly_interest_rate_bps", value: -1 },
    { field: "installment_count", value: 0 },
    { field: "frequency_interval", value: 0 },
    { field: "capitalized_amount_cents", value: -1 },
    { field: "late_fee_bps", value: -1 },
    { field: "late_interest_monthly_bps", value: -1 },
    { field: "grace_period_days", value: -1 },
    { field: "rounding_step_cents", value: 0 },
  ])("refuses $field = $value", async ({ field, value }) => {
    await expect(add({ [field]: value })).rejects.toThrow(/check constraint/);
  });

  it.each(["RENEWAL", "RENEGOTIATION", "IMPORT"])("accepts the origin_type %s", async (originType) => {
    expect((await add({ origin_type: originType })).affectedRows).toBe(1);
  });

  it("accepts an origin loan that exists in lending", async () => {
    const origin = id();
    await add({ id: origin });
    expect((await add({ origin_loan_id: origin, origin_type: "RENEWAL" })).affectedRows).toBe(1);
  });

  it("refuses an origin loan that does not exist", async () => {
    await expect(add({ origin_loan_id: "01970000-0000-7000-8000-ffffffffffff" })).rejects.toThrow(
      /foreign key constraint/,
    );
  });

  it("has the indexes of RFC-005 §4", async () => {
    expect(await indexesOf(client, "lending", "loans")).toEqual([
      "CREATE INDEX loans_account_id_idx ON lending.loans USING btree (account_id)",
      "CREATE UNIQUE INDEX loans_loan_number_key ON lending.loans USING btree (loan_number)",
      "CREATE INDEX loans_origin_loan_id_idx ON lending.loans USING btree (origin_loan_id)",
      "CREATE INDEX loans_person_id_status_idx ON lending.loans USING btree (person_id, status)",
      "CREATE UNIQUE INDEX loans_pkey ON lending.loans USING btree (id)",
      "CREATE INDEX loans_status_idx ON lending.loans USING btree (status)",
    ]);
  });
});
