import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migratedTestDb } from "../../db/test-db";

// Contrato da tabela em SQL (RFC-005 §2): o teste não depende dos nomes TypeScript do schema.ts.
const insert =
  "insert into core.attachments (id, kind, file_name, content_type, size_bytes, sha256, storage_key, uploaded_by, uploaded_at)";
const sha = "a".repeat(64);
const uploader = "01970000-0000-7000-8000-0000000000aa";
type Column = { column_name: string; data_type: string; is_nullable: string; character_maximum_length: number | null };

describe("core.attachments (RFC-005 §2)", () => {
  let client: PGlite;
  let seq = 0;
  const add = (kind: string, key = `k/${String(++seq)}`, size = 10, hash = sha) =>
    client.query(`${insert} values (gen_random_uuid(), $1, 'r.pdf', 'application/pdf', $2, $3, $4, $5, now())`, [
      kind,
      size,
      hash,
      key,
      uploader,
    ]);
  beforeAll(async () => ({ client } = await migratedTestDb()));
  afterAll(async () => client.close());

  it("has exactly the columns of RFC-005 §2, all not null", async () => {
    const { rows } = await client.query<Column>(
      "select column_name, data_type, is_nullable, character_maximum_length from information_schema.columns where table_schema = 'core' and table_name = 'attachments' order by column_name",
    );
    expect(
      rows.map(
        (c) =>
          `${c.column_name} ${c.data_type}${c.character_maximum_length ? `(${String(c.character_maximum_length)})` : ""} ${c.is_nullable === "YES" ? "null" : "not null"}`,
      ),
    ).toEqual([
      "content_type text not null",
      "file_name text not null",
      "id uuid not null",
      "kind text not null",
      "sha256 character(64) not null",
      "size_bytes bigint not null",
      "storage_key text not null",
      "uploaded_at timestamp with time zone not null",
      "uploaded_by uuid not null",
    ]);
  });

  it.each(["RECEIPT", "SIGNED_CONTRACT", "IMPORT_FILE", "OTHER"])("accepts kind %s", async (kind) => {
    expect((await add(kind)).affectedRows).toBe(1);
  });

  it("refuses a kind outside the list", async () => {
    await expect(add("PHOTO")).rejects.toThrow(/check constraint/);
  });

  it("refuses a negative size", async () => {
    await expect(add("RECEIPT", "k/neg", -1)).rejects.toThrow(/check constraint/);
  });

  it("refuses a sha256 that is not 64 lowercase hex digits", async () => {
    await expect(add("RECEIPT", "k/bad-sha", 10, "Z".repeat(64))).rejects.toThrow(/check constraint/);
  });

  it("refuses a repeated storage_key", async () => {
    await add("RECEIPT", "k/same");
    await expect(add("OTHER", "k/same")).rejects.toThrow(/unique constraint/);
  });
});
