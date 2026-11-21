import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { columnsOf, insertRow, testIds } from "../../db/table-contract";
import { migratedTestDb } from "../../db/test-db";

// Check de status e colunas de rejeição em SQL (RFC-005 §5): o teste não depende dos nomes do schema.ts.
describe("payments.payments status and rejection columns (RFC-005 §5, E11-F04)", () => {
  let client: PGlite;
  const id = testIds();
  const add = (fields: Record<string, unknown> = {}) =>
    insertRow<Record<string, unknown>>(client, "payments.payments", {
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

  it.each(["PENDING_REVIEW", "CONFIRMED", "REVERSED", "REJECTED"])(
    "C17 (A15): accepts the status %s",
    async (status) => {
      expect((await add({ status })).affectedRows).toBe(1);
    },
  );

  it.each(["PAID", "CANCELLED", "rejected", ""])("C18 (A15): still refuses the status %j", async (status) => {
    await expect(add({ status })).rejects.toThrow(/check constraint/);
  });

  it("C17 (A15): has the nullable columns rejected_at, rejected_by and rejection_reason", async () => {
    const columns = await columnsOf(client, "payments", "payments");
    expect(columns).toContain("rejected_at timestamp with time zone null");
    expect(columns).toContain("rejected_by uuid null");
    expect(columns).toContain("rejection_reason text null");
  });

  it("C17 (A15): stores the rejection of a REJECTED row", async () => {
    const actor = id();
    const { rows } = await add({
      status: "REJECTED",
      rejected_at: "2026-11-21T12:00:00Z",
      rejected_by: actor,
      rejection_reason: "valor errado",
    });
    expect(rows[0]).toMatchObject({ status: "REJECTED", rejected_by: actor, rejection_reason: "valor errado" });
    expect(rows[0]?.rejected_at).toBeInstanceOf(Date);
  });
});
