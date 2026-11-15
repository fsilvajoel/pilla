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
type Address = { is_primary: boolean; version: number; created_at: Date | null; updated_at: Date | null };

describe("people.addresses (RFC-005 §3)", () => {
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
  const add = (fields: Record<string, string | boolean | null>) => {
    const row = {
      id: id(),
      street: "Rua A",
      number: "10",
      district: "Centro",
      city: "São Paulo",
      state: "SP",
      postal_code: "01001000",
      ...fields,
    };
    const cols = Object.keys(row);
    return client.query<Address>(
      `insert into people.addresses (${cols.join(", ")}) values (${cols.map((_, i) => `$${String(i + 1)}`).join(", ")}) returning *`,
      Object.values(row),
    );
  };
  beforeAll(async () => ({ client } = await migratedTestDb()));
  afterAll(async () => client.close());

  it("has exactly the columns of RFC-005 §3", async () => {
    const { rows } = await client.query<Column>(
      "select column_name, data_type, is_nullable, character_maximum_length, column_default from information_schema.columns where table_schema = 'people' and table_name = 'addresses' order by column_name",
    );
    expect(
      rows.map(
        (c) =>
          `${c.column_name} ${c.data_type}${c.character_maximum_length ? `(${String(c.character_maximum_length)})` : ""} ${c.is_nullable === "YES" ? "null" : "not null"}${c.column_default ? ` default ${c.column_default}` : ""}`,
      ),
    ).toEqual([
      "city text not null",
      "complement text null",
      "created_at timestamp with time zone not null default now()",
      "district text not null",
      "id uuid not null",
      "is_primary boolean not null default false",
      "number text not null",
      "person_id uuid not null",
      "postal_code character(8) not null",
      "state character(2) not null",
      "street text not null",
      "updated_at timestamp with time zone not null default now()",
      "version integer not null default 1",
    ]);
  });

  it("fills is_primary, version, created_at and updated_at by default", async () => {
    const { rows } = await add({ person_id: await person() });
    expect(rows[0]).toMatchObject({ is_primary: false, version: 1 });
    expect(rows[0]?.created_at).toBeInstanceOf(Date);
    expect(rows[0]?.updated_at).toBeInstanceOf(Date);
  });

  it("refuses an address of a person that does not exist", async () => {
    await expect(add({ person_id: "01970000-0000-7000-8000-ffffffffffff" })).rejects.toThrow(/foreign key constraint/);
  });

  it.each(["sp", "S1"])("refuses the state %s (two capital letters)", async (state) => {
    await expect(add({ person_id: await person(), state })).rejects.toThrow(/check constraint/);
  });

  it.each(["01001-00", "0100100a"])("refuses the postal_code %s (8 digits)", async (postalCode) => {
    await expect(add({ person_id: await person(), postal_code: postalCode })).rejects.toThrow(/check constraint/);
  });

  it("accepts many addresses per person but only one primary", async () => {
    const pid = await person();
    await add({ person_id: pid, is_primary: true });
    await add({ person_id: pid, is_primary: false });
    await add({ person_id: pid, is_primary: false });
    await expect(add({ person_id: pid, is_primary: true })).rejects.toThrow(/unique constraint/);
  });

  it("has the indexes of RFC-005 §3", async () => {
    const { rows } = await client.query<{ indexdef: string }>(
      "select indexdef from pg_indexes where schemaname = 'people' and tablename = 'addresses' order by indexname",
    );
    expect(rows.map((r) => r.indexdef)).toEqual([
      "CREATE UNIQUE INDEX addresses_one_primary_idx ON people.addresses USING btree (person_id) WHERE is_primary",
      "CREATE UNIQUE INDEX addresses_pkey ON people.addresses USING btree (id)",
    ]);
  });
});
