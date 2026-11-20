import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migratedTestDb } from "./test-db";

// Convenções da RFC-005 §1 conferidas no banco já migrado: valem para toda tabela que entrar depois.
const moduleSchemas = ["core", "people", "lending", "payments", "treasury", "access"];
const inModules = `table_schema in (${moduleSchemas.map((s) => `'${s}'`).join(", ")})`;

type Column = { table_schema: string; table_name: string; column_name: string; data_type: string };

describe("database conventions (RFC-005 §1)", () => {
  let client: PGlite;
  let columns: Column[];
  const where = (c: Column) => `${c.table_schema}.${c.table_name}.${c.column_name} (${c.data_type})`;

  beforeAll(async () => {
    ({ client } = await migratedTestDb());
    ({ rows: columns } = await client.query<Column>(
      `select table_schema, table_name, column_name, data_type from information_schema.columns where ${inModules}`,
    ));
  });
  afterAll(async () => client.close());

  it("creates tables only inside the module schemas", async () => {
    const { rows } = await client.query<{ table_schema: string }>(
      "select distinct table_schema from information_schema.tables where table_schema not in ('pg_catalog', 'information_schema', 'drizzle')",
    );
    expect(rows.map((r) => r.table_schema).filter((s) => !moduleSchemas.includes(s))).toEqual([]);
    expect(columns.length).toBeGreaterThan(0);
  });

  it("stores money as bigint (*_cents, ADR-0004)", () => {
    const bad = columns.filter((c) => c.column_name.endsWith("_cents") && c.data_type !== "bigint");
    expect(bad.map(where)).toEqual([]);
  });

  it("stores rates as integer basis points (*_bps)", () => {
    const bad = columns.filter((c) => c.column_name.endsWith("_bps") && c.data_type !== "integer");
    expect(bad.map(where)).toEqual([]);
  });

  // Datas de negócio são `date` (RFC-005 §1); estas três têm sufixo _at mas o RFC as tipa como date (§4, §5).
  const businessDatesNamedAt = [
    "lending.loans.contracted_at",
    "lending.loans.disbursed_at",
    "payments.payments.paid_at",
  ];

  it("stores instants with time zone (*_at)", () => {
    const bad = columns.filter(
      (c) =>
        c.column_name.endsWith("_at") &&
        c.data_type !== "timestamp with time zone" &&
        !(
          c.data_type === "date" && businessDatesNamedAt.includes(`${c.table_schema}.${c.table_name}.${c.column_name}`)
        ),
    );
    expect(bad.map(where)).toEqual([]);
  });

  it("never stores a timestamp without time zone", () => {
    const bad = columns.filter((c) => c.data_type === "timestamp without time zone");
    expect(bad.map(where)).toEqual([]);
  });

  it("has no foreign key between schemas (ADR-0002)", async () => {
    const { rows } = await client.query<{ name: string; from_schema: string; to_schema: string }>(
      `select con.conname as name, src.nspname as from_schema, dst.nspname as to_schema
         from pg_constraint con
         join pg_class sc on sc.oid = con.conrelid join pg_namespace src on src.oid = sc.relnamespace
         join pg_class dc on dc.oid = con.confrelid join pg_namespace dst on dst.oid = dc.relnamespace
        where con.contype = 'f' and src.nspname <> dst.nspname`,
    );
    expect(rows).toEqual([]);
  });

  it("gives every table a primary key", async () => {
    const { rows } = await client.query<{ table: string }>(
      `select t.table_schema || '.' || t.table_name as table from information_schema.tables t
        where t.${inModules} and not exists (
          select 1 from information_schema.table_constraints c
           where c.table_schema = t.table_schema and c.table_name = t.table_name and c.constraint_type = 'PRIMARY KEY')`,
    );
    expect(rows).toEqual([]);
  });
});
