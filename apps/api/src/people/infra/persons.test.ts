import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migratedTestDb } from "../../db/test-db";

// Contrato da tabela em SQL (RFC-005 §3, RN-P01, RN-P02): o teste não depende dos nomes TypeScript do schema.ts.
type Column = {
  column_name: string;
  data_type: string;
  is_nullable: string;
  character_maximum_length: number | null;
  column_default: string | null;
};
type Person = {
  active: boolean;
  version: number;
  created_at: Date | null;
  updated_at: Date | null;
  referred_by_id: string | null;
};

describe("people.persons (RFC-005 §3)", () => {
  let client: PGlite;
  let seq = 0;
  const id = () => `01970000-0000-7000-8000-${String(++seq).padStart(12, "0")}`;
  const add = (fields: Record<string, string | null> = {}) => {
    const row: Record<string, string | null> = { id: id(), full_name: "Ana Souza", phone: "+5511999990000", ...fields };
    const cols = Object.keys(row);
    return client.query<Person>(
      `insert into people.persons (${cols.join(", ")}) values (${cols.map((_, i) => `$${String(i + 1)}`).join(", ")}) returning *`,
      Object.values(row),
    );
  };
  beforeAll(async () => ({ client } = await migratedTestDb()));
  afterAll(async () => client.close());

  it("has exactly the columns of RFC-005 §3", async () => {
    const { rows } = await client.query<Column>(
      "select column_name, data_type, is_nullable, character_maximum_length, column_default from information_schema.columns where table_schema = 'people' and table_name = 'persons' order by column_name",
    );
    expect(
      rows.map(
        (c) =>
          `${c.column_name} ${c.data_type}${c.character_maximum_length ? `(${String(c.character_maximum_length)})` : ""} ${c.is_nullable === "YES" ? "null" : "not null"}${c.column_default ? ` default ${c.column_default}` : ""}`,
      ),
    ).toEqual([
      "active boolean not null default true",
      "anonymized_at timestamp with time zone null",
      "birth_date date null",
      "cpf character(11) null",
      "created_at timestamp with time zone not null default now()",
      "email text null",
      "full_name text not null",
      "id uuid not null",
      "notes text null",
      "phone text not null",
      "referred_by_id uuid null",
      "updated_at timestamp with time zone not null default now()",
      "version integer not null default 1",
    ]);
  });

  it("fills active, version, created_at and updated_at by default", async () => {
    const { rows } = await add();
    expect(rows[0]).toMatchObject({ active: true, version: 1 });
    expect(rows[0]?.created_at).toBeInstanceOf(Date);
    expect(rows[0]?.updated_at).toBeInstanceOf(Date);
  });

  it("accepts a cpf of 11 digits and many persons without cpf (RN-P01)", async () => {
    const results = [await add({ cpf: "12345678901" }), await add({ cpf: null }), await add({ cpf: null })];
    expect(results.map((r) => r.affectedRows)).toEqual([1, 1, 1]);
  });

  it.each(["1234567890a", "123.456.789"])("refuses the cpf %s (only digits)", async (cpf) => {
    await expect(add({ cpf })).rejects.toThrow(/check constraint/);
  });

  it("refuses a repeated cpf (RN-P01)", async () => {
    await add({ cpf: "98765432100" });
    await expect(add({ cpf: "98765432100" })).rejects.toThrow(/unique constraint/);
  });

  it.each(["11999990000", "+0511999990000", "+55 11 99999"])("refuses the phone %s (E.164)", async (phone) => {
    await expect(add({ phone })).rejects.toThrow(/check constraint/);
  });

  it("accepts a referrer that is a registered person (RN-P02)", async () => {
    const referrer = id();
    await add({ id: referrer });
    const { rows } = await add({ referred_by_id: referrer });
    expect(rows[0]?.referred_by_id).toBe(referrer);
  });

  it("refuses a referrer that is not a registered person (RN-P02)", async () => {
    await expect(add({ referred_by_id: "01970000-0000-7000-8000-ffffffffffff" })).rejects.toThrow(
      /foreign key constraint/,
    );
  });

  it("refuses a person who refers to themselves (RN-P02)", async () => {
    const self = id();
    await expect(add({ id: self, referred_by_id: self })).rejects.toThrow(/check constraint/);
  });

  it("has the indexes of RFC-005 §3", async () => {
    const { rows } = await client.query<{ indexdef: string }>(
      "select indexdef from pg_indexes where schemaname = 'people' and tablename = 'persons' order by indexname",
    );
    expect(rows.map((r) => r.indexdef)).toEqual([
      "CREATE UNIQUE INDEX persons_cpf_key ON people.persons USING btree (cpf) WHERE (cpf IS NOT NULL)",
      "CREATE INDEX persons_full_name_idx ON people.persons USING btree (lower(full_name))",
      "CREATE INDEX persons_phone_idx ON people.persons USING btree (phone)",
      "CREATE UNIQUE INDEX persons_pkey ON people.persons USING btree (id)",
      "CREATE INDEX persons_referred_by_id_idx ON people.persons USING btree (referred_by_id)",
    ]);
  });
});
