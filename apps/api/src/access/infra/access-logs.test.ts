import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { columnsOf, indexesOf, insertRow, testIds } from "../../db/table-contract";
import { migratedTestDb } from "../../db/test-db";

// Contrato da tabela em SQL (RFC-005 §7): tentativa de entrada no portal, só acrescenta.
describe("access.access_logs (RFC-005 §7)", () => {
  let client: PGlite;
  const id = testIds();
  const add = (fields: Record<string, unknown> = {}) =>
    insertRow<{ at: Date | null; ip: string; result: string }>(client, "access.access_logs", {
      id: id(),
      ip: "203.0.113.7",
      cpf_hash: "a".repeat(64),
      result: "OK",
      ...fields,
    });
  beforeAll(async () => ({ client } = await migratedTestDb()));
  afterAll(async () => client.close());

  it("has exactly the columns of RFC-005 §7", async () => {
    expect(await columnsOf(client, "access", "access_logs")).toEqual([
      "at timestamp with time zone not null default now()",
      "cpf_hash character not null",
      "id uuid not null",
      "ip inet not null",
      "result text not null",
    ]);
  });

  it("fills at and keeps the ip", async () => {
    const { rows } = await add();
    expect(rows[0]?.at).toBeInstanceOf(Date);
    expect(rows[0]?.ip).toBe("203.0.113.7");
  });

  it.each(["OK", "NOT_FOUND", "DISABLED", "RATE_LIMITED"])("accepts result %s", async (result) => {
    const { rows } = await add({ result });
    expect(rows[0]?.result).toBe(result);
  });

  it("refuses an unknown result", async () => {
    await expect(add({ result: "ERROR" })).rejects.toThrow(/check constraint/);
  });

  it("refuses an invalid ip", async () => {
    await expect(add({ ip: "not-an-ip" })).rejects.toThrow(/inet/);
  });

  it("has the indexes of RFC-005 §7", async () => {
    expect(await indexesOf(client, "access", "access_logs")).toEqual([
      "CREATE INDEX access_logs_ip_at_idx ON access.access_logs USING btree (ip, at)",
      "CREATE UNIQUE INDEX access_logs_pkey ON access.access_logs USING btree (id)",
    ]);
  });
});
