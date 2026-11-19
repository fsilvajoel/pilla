import type { PGlite } from "@electric-sql/pglite";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { migratedTestDb } from "../../db/test-db";
import { updatePerson } from "./person-update";

describe("updatePerson", () => {
  let client: PGlite;
  let db: PgliteDatabase;

  beforeAll(async () => {
    const opened = await migratedTestDb();
    client = opened.client;
    db = opened.db;
  });

  afterAll(async () => {
    await client.close();
  });

  beforeEach(async () => {
    await client.query("delete from people.persons");
  });

  it("C1 (A1): resolves to UPDATED with all fields updated", async () => {
    await client.query(
      `insert into people.persons (id, full_name, cpf, phone, updated_at, version)
       values ('01970000-0000-7000-8000-000000000100', 'Ana Costa', '52998224725', '+5511987654321', '2026-01-01 00:00:00+00', 3)`,
    );

    const result = await updatePerson(db, "01970000-0000-7000-8000-000000000100", 3, {
      fullName: "Ana Teixeira",
      cpf: "39053344705",
      phone: "+5511987654000",
      email: "ana@example.com",
      birthDate: "1990-04-15",
      notes: "dados revisados",
    });

    expect(result).toBe("UPDATED");

    const { rows } = await client.query<{
      full_name: string;
      cpf: string | null;
      phone: string;
      email: string | null;
      birth_date: string | null;
      notes: string | null;
      version: number;
      active: boolean;
      referred_by_id: string | null;
      updated_at: string;
    }>(
      `select full_name, cpf, phone, email, birth_date::text as birth_date, notes, version, active, referred_by_id, updated_at::text as updated_at
       from people.persons where id = '01970000-0000-7000-8000-000000000100'`,
    );

    expect(rows).toHaveLength(1);
    const { updated_at: updatedAt, ...row } = rows[0] ?? { updated_at: "" };
    expect(row).toEqual({
      full_name: "Ana Teixeira",
      cpf: "39053344705",
      phone: "+5511987654000",
      email: "ana@example.com",
      birth_date: "1990-04-15",
      notes: "dados revisados",
      version: 4,
      active: true,
      referred_by_id: null,
    });
    expect(updatedAt).not.toContain("2026-01-01");
  });

  it("C2 (A2): resolves to NOT_FOUND for non-existent id", async () => {
    const result = await updatePerson(db, "01970000-0000-7000-8000-000000000199", 1, {
      fullName: "Pessoa Nova",
    });

    expect(result).toBe("NOT_FOUND");
  });

  it("C3 (A3): resolves to VERSION_CONFLICT and leaves row unchanged", async () => {
    await client.query(
      `insert into people.persons (id, full_name, phone, version)
       values ('01970000-0000-7000-8000-000000000101', 'Bruno Dias', '+5511987654101', 1)`,
    );

    const result = await updatePerson(db, "01970000-0000-7000-8000-000000000101", 0, {
      fullName: "Nome não aplicado",
    });

    expect(result).toBe("VERSION_CONFLICT");

    const { rows } = await client.query<{
      full_name: string;
      version: number;
    }>(`select full_name, version from people.persons where id = '01970000-0000-7000-8000-000000000101'`);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      full_name: "Bruno Dias",
      version: 1,
    });
  });

  it("C4 (A4): rejects with cause.code 23505 and cause.constraint persons_cpf_key", async () => {
    await client.query(
      `insert into people.persons (id, full_name, cpf, phone, version)
       values ('01970000-0000-7000-8000-000000000100', 'Ana Costa', '52998224725', '+5511987654321', 1)`,
    );
    await client.query(
      `insert into people.persons (id, full_name, cpf, phone, version)
       values ('01970000-0000-7000-8000-000000000101', 'Bruno Dias', '11144477735', '+5511987654101', 1)`,
    );

    await expect(
      updatePerson(db, "01970000-0000-7000-8000-000000000100", 1, {
        cpf: "11144477735",
      }),
    ).rejects.toMatchObject({
      cause: {
        code: "23505",
        constraint: "persons_cpf_key",
      },
    });
  });

  it("C10 (A1): resolves to UPDATED and clears email, birthDate, notes while cpf remains", async () => {
    await client.query(
      `insert into people.persons (id, full_name, cpf, phone, email, birth_date, notes, version)
       values ('01970000-0000-7000-8000-000000000103', 'Carla Mendes', '39053344705', '+5511987654103', 'carla@example.com', '1988-05-20', 'dados antigos', 3)`,
    );

    const result = await updatePerson(db, "01970000-0000-7000-8000-000000000103", 3, {
      email: null,
      birthDate: null,
      notes: null,
    });

    expect(result).toBe("UPDATED");

    const { rows } = await client.query<{
      full_name: string;
      cpf: string | null;
      phone: string;
      email: string | null;
      birth_date: string | null;
      notes: string | null;
      version: number;
      active: boolean;
      referred_by_id: string | null;
    }>(
      `select full_name, cpf, phone, email, birth_date::text as birth_date, notes, version, active, referred_by_id
       from people.persons where id = '01970000-0000-7000-8000-000000000103'`,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      full_name: "Carla Mendes",
      cpf: "39053344705",
      phone: "+5511987654103",
      email: null,
      birth_date: null,
      notes: null,
      version: 4,
      active: true,
      referred_by_id: null,
    });
  });
});
