import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { columnsOf, indexesOf, insertRow, testIds } from "../../db/table-contract";
import { migratedTestDb } from "../../db/test-db";

// Contrato da tabela em SQL (RFC-005 §5, RN-C20): o teste não depende dos nomes TypeScript do schema.ts.
type Payment = { is_recovery: boolean; version: number; created_at: Date | null; updated_at: Date | null };

describe("payments.payments (RFC-005 §5)", () => {
  let client: PGlite;
  const id = testIds();
  const add = (fields: Record<string, unknown> = {}) =>
    insertRow<Payment>(client, "payments.payments", {
      id: id(),
      loan_id: id(),
      person_id: id(),
      account_id: id(),
      paid_at: "2026-11-16",
      amount_cents: 43500,
      method: "CASH",
      channel: "ADMIN",
      status: "PENDING_REVIEW",
      created_by: id(),
      ...fields,
    });
  beforeAll(async () => ({ client } = await migratedTestDb()));
  afterAll(async () => client.close());

  it("has exactly the columns of RFC-005 §5", async () => {
    expect(await columnsOf(client, "payments", "payments")).toEqual([
      "account_id uuid not null",
      "amount_cents bigint not null",
      "channel text not null",
      "confirmed_at timestamp with time zone null",
      "confirmed_by uuid null",
      "created_at timestamp with time zone not null default now()",
      "created_by uuid not null",
      "id uuid not null",
      "idempotency_key text null",
      "is_recovery boolean not null default false",
      "loan_id uuid not null",
      "method text not null",
      "paid_at date not null",
      "person_id uuid not null",
      "pix_end_to_end_id text null",
      "receipt_attachment_id uuid null",
      "rejected_at timestamp with time zone null",
      "rejected_by uuid null",
      "rejection_reason text null",
      "reversal_reason text null",
      "reversed_at timestamp with time zone null",
      "reversed_by uuid null",
      "status text not null",
      "updated_at timestamp with time zone not null default now()",
      "version integer not null default 1",
    ]);
  });

  it("fills is_recovery, version and the instants by default", async () => {
    const { rows } = await add();
    expect(rows[0]).toMatchObject({ is_recovery: false, version: 1 });
    expect(rows[0]?.created_at).toBeInstanceOf(Date);
    expect(rows[0]?.updated_at).toBeInstanceOf(Date);
  });

  it.each(["PIX", "BOLETO", "CASH", "BANK_TRANSFER"])("accepts the method %s", async (method) => {
    expect((await add({ method })).affectedRows).toBe(1);
  });

  it.each(["PENDING_REVIEW", "CONFIRMED", "REVERSED", "REJECTED"])("accepts the status %s", async (status) => {
    expect((await add({ status })).affectedRows).toBe(1);
  });

  it.each([
    { field: "amount_cents", value: 0 },
    { field: "method", value: "CARD" },
    { field: "channel", value: "PORTAL" },
    { field: "status", value: "PAID" },
  ])("refuses $field = $value", async ({ field, value }) => {
    await expect(add({ [field]: value })).rejects.toThrow(/check constraint/);
  });

  it("refuses a repeated pix_end_to_end_id and accepts many payments without one", async () => {
    await add({ method: "PIX", pix_end_to_end_id: "E00000000202611161200abcdef12345" });
    await expect(add({ method: "PIX", pix_end_to_end_id: "E00000000202611161200abcdef12345" })).rejects.toThrow(
      /unique constraint/,
    );
    const results = [await add({ pix_end_to_end_id: null }), await add({ pix_end_to_end_id: null })];
    expect(results.map((r) => r.affectedRows)).toEqual([1, 1]);
  });

  it("refuses a repeated idempotency_key", async () => {
    await add({ idempotency_key: "k-1" });
    await expect(add({ idempotency_key: "k-1" })).rejects.toThrow(/unique constraint/);
  });

  it("has the indexes of RFC-005 §5", async () => {
    expect(await indexesOf(client, "payments", "payments")).toEqual([
      "CREATE INDEX payments_account_id_idx ON payments.payments USING btree (account_id)",
      "CREATE UNIQUE INDEX payments_idempotency_key_key ON payments.payments USING btree (idempotency_key)",
      "CREATE INDEX payments_loan_id_status_idx ON payments.payments USING btree (loan_id, status)",
      "CREATE INDEX payments_pending_review_idx ON payments.payments USING btree (status) WHERE (status = 'PENDING_REVIEW'::text)",
      "CREATE INDEX payments_person_id_idx ON payments.payments USING btree (person_id)",
      "CREATE UNIQUE INDEX payments_pix_end_to_end_id_key ON payments.payments USING btree (pix_end_to_end_id) WHERE (pix_end_to_end_id IS NOT NULL)",
      "CREATE UNIQUE INDEX payments_pkey ON payments.payments USING btree (id)",
      "CREATE INDEX payments_receipt_attachment_id_idx ON payments.payments USING btree (receipt_attachment_id)",
    ]);
  });
});
