import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migratedTestDb } from "../../db/test-db";

// Contrato da tabela em SQL (RFC-005 §3): o teste não depende dos nomes TypeScript do schema.ts.
type Column = {
  column_name: string;
  data_type: string;
  is_nullable: string;
  character_maximum_length: number | null;
  column_default: string | null;
};
type PixKey = { is_primary: boolean; version: number; created_at: Date | null; updated_at: Date | null };

describe("people.pix_keys (RFC-005 §3)", () => {
  let client: PGlite;
  let seq = 0;
  const id = () => `01970000-0000-7000-8000-${String(++seq).padStart(12, "0")}`;
  const person = async () => {
    const pid = id();
    await client.query("insert into people.persons (id, full_name, phone) values ($1, 'Ana Souza', '+5511999990000')", [
      pid,
    ]);
    return pid;
  };
  const add = (owner: string, type: string, value = `v${String(++seq)}`, isPrimary = false) =>
    client.query<PixKey>(
      "insert into people.pix_keys (id, owner_person_id, type, value, is_primary) values ($1, $2, $3, $4, $5) returning *",
      [id(), owner, type, value, isPrimary],
    );
  beforeAll(async () => ({ client } = await migratedTestDb()));
  afterAll(async () => client.close());

  it("has exactly the columns of RFC-005 §3", async () => {
    const { rows } = await client.query<Column>(
      "select column_name, data_type, is_nullable, character_maximum_length, column_default from information_schema.columns where table_schema = 'people' and table_name = 'pix_keys' order by column_name",
    );
    expect(
      rows.map(
        (c) =>
          `${c.column_name} ${c.data_type}${c.character_maximum_length ? `(${String(c.character_maximum_length)})` : ""} ${c.is_nullable === "YES" ? "null" : "not null"}${c.column_default ? ` default ${c.column_default}` : ""}`,
      ),
    ).toEqual([
      "created_at timestamp with time zone not null default now()",
      "id uuid not null",
      "is_primary boolean not null default false",
      "owner_person_id uuid not null",
      "type text not null",
      "updated_at timestamp with time zone not null default now()",
      "value text not null",
      "version integer not null default 1",
    ]);
  });

  it("fills is_primary, version, created_at and updated_at by default", async () => {
    const { rows } = await client.query<PixKey>(
      "insert into people.pix_keys (id, owner_person_id, type, value) values ($1, $2, 'EMAIL', 'ana@example.com') returning *",
      [id(), await person()],
    );
    expect(rows[0]).toMatchObject({ is_primary: false, version: 1 });
    expect(rows[0]?.created_at).toBeInstanceOf(Date);
    expect(rows[0]?.updated_at).toBeInstanceOf(Date);
  });

  it.each(["CPF", "CNPJ", "EMAIL", "PHONE", "RANDOM"])("accepts type %s", async (type) => {
    await add(await person(), type);
  });

  it("refuses a type outside the list", async () => {
    await expect(add(await person(), "BANK")).rejects.toThrow(/check constraint/);
  });

  it("refuses a key of a person that does not exist", async () => {
    await expect(add("01970000-0000-7000-8000-ffffffffffff", "EMAIL")).rejects.toThrow(/foreign key constraint/);
  });

  it("refuses the same type and value twice, even for another person", async () => {
    await add(await person(), "PHONE", "+5511988887777");
    await expect(add(await person(), "PHONE", "+5511988887777")).rejects.toThrow(/unique constraint/);
  });

  it("accepts many keys per person but only one primary", async () => {
    const pid = await person();
    await add(pid, "EMAIL", undefined, true);
    await add(pid, "RANDOM");
    await expect(add(pid, "PHONE", undefined, true)).rejects.toThrow(/unique constraint/);
  });

  it("has the indexes of RFC-005 §3", async () => {
    const { rows } = await client.query<{ indexdef: string }>(
      "select indexdef from pg_indexes where schemaname = 'people' and tablename = 'pix_keys' order by indexname",
    );
    expect(rows.map((r) => r.indexdef)).toEqual([
      "CREATE UNIQUE INDEX pix_keys_one_primary_idx ON people.pix_keys USING btree (owner_person_id) WHERE is_primary",
      "CREATE UNIQUE INDEX pix_keys_pkey ON people.pix_keys USING btree (id)",
      "CREATE UNIQUE INDEX pix_keys_type_value_key ON people.pix_keys USING btree (type, value)",
    ]);
  });
});
