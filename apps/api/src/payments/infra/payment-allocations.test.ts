import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { columnsOf, indexesOf, insertRow, testIds } from "../../db/table-contract";
import { migratedTestDb } from "../../db/test-db";

// Contrato da tabela em SQL (RFC-005 §5): alocação só acrescenta; o estorno marca reversed_at.
describe("payments.payment_allocations (RFC-005 §5)", () => {
  let client: PGlite;
  const id = testIds();
  let paymentId = "";
  const add = (fields: Record<string, unknown> = {}) =>
    insertRow<{ reversed_at: Date | null; created_at: Date | null }>(client, "payments.payment_allocations", {
      id: id(),
      payment_id: paymentId,
      loan_id: id(),
      installment_id: id(),
      late_charges_cents: 0,
      interest_cents: 10000,
      principal_cents: 33500,
      ...fields,
    });
  beforeAll(async () => {
    ({ client } = await migratedTestDb());
    paymentId = id();
    await insertRow(client, "payments.payments", {
      id: paymentId,
      loan_id: id(),
      person_id: id(),
      account_id: id(),
      paid_at: "2026-11-16",
      amount_cents: 43500,
      method: "CASH",
      channel: "ADMIN",
      status: "CONFIRMED",
      created_by: id(),
    });
  });
  afterAll(async () => client.close());

  it("has exactly the columns of RFC-005 §5", async () => {
    expect(await columnsOf(client, "payments", "payment_allocations")).toEqual([
      "created_at timestamp with time zone not null default now()",
      "id uuid not null",
      "installment_id uuid not null",
      "interest_cents bigint not null",
      "late_charges_cents bigint not null",
      "loan_id uuid not null",
      "payment_id uuid not null",
      "principal_cents bigint not null",
      "reversed_at timestamp with time zone null",
    ]);
  });

  it("starts not reversed, with created_at filled", async () => {
    const { rows } = await add();
    expect(rows[0]?.reversed_at).toBeNull();
    expect(rows[0]?.created_at).toBeInstanceOf(Date);
  });

  it.each(["late_charges_cents", "interest_cents", "principal_cents"])("refuses a negative %s", async (field) => {
    await expect(add({ [field]: -1 })).rejects.toThrow(/check constraint/);
  });

  it("refuses a payment that does not exist", async () => {
    await expect(add({ payment_id: "01970000-0000-7000-8000-ffffffffffff" })).rejects.toThrow(/foreign key constraint/);
  });

  it("has the indexes of RFC-005 §5", async () => {
    expect(await indexesOf(client, "payments", "payment_allocations")).toEqual([
      "CREATE INDEX payment_allocations_loan_id_idx ON payments.payment_allocations USING btree (loan_id)",
      "CREATE INDEX payment_allocations_open_installment_id_idx ON payments.payment_allocations USING btree (installment_id) WHERE (reversed_at IS NULL)",
      "CREATE INDEX payment_allocations_payment_id_idx ON payments.payment_allocations USING btree (payment_id)",
      "CREATE UNIQUE INDEX payment_allocations_pkey ON payments.payment_allocations USING btree (id)",
    ]);
  });
});
