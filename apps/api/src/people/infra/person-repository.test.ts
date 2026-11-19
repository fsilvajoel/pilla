import type { PGlite } from "@electric-sql/pglite";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migratedTestDb } from "../../db/test-db";
import { findPersonById, insertPerson } from "./person-repository";

describe("insertPerson", () => {
  let db: PgliteDatabase;
  let client: PGlite;

  beforeAll(async () => {
    ({ db, client } = await migratedTestDb());
  });

  afterAll(async () => {
    await client.close();
  });

  it("C1 (A1): Maria only with name, cpf and phone gets defaults for email, birth_date, referred_by_id, notes, active true and version 1", async () => {
    const mariaId = "01970000-0000-7000-8000-000000000001";
    await expect(
      insertPerson(db, {
        id: mariaId,
        fullName: "Maria Souza",
        cpf: "52998224725",
        phone: "+5511987654321",
      }),
    ).resolves.toBeUndefined();

    const { rows } = await client.query<{
      full_name: string;
      cpf: string | null;
      phone: string;
      email: string | null;
      birth_date: string | null;
      referred_by_id: string | null;
      notes: string | null;
      active: boolean;
      version: number;
    }>(
      "select full_name, cpf, phone, email, birth_date::text as birth_date, referred_by_id, notes, active, version from people.persons where id = $1",
      [mariaId],
    );

    expect(rows).toEqual([
      {
        full_name: "Maria Souza",
        cpf: "52998224725",
        phone: "+5511987654321",
        email: null,
        birth_date: null,
        referred_by_id: null,
        notes: null,
        active: true,
        version: 1,
      },
    ]);
  });

  it("C2 (A2): João with all fields and referredById of Ana stores every field, cpf null and referred_by_id equal to Ana id", async () => {
    const anaId = "01970000-0000-7000-8000-000000000002";
    await insertPerson(db, {
      id: anaId,
      fullName: "Ana Costa",
      cpf: null,
      phone: "+5511900000002",
    });

    const joaoId = "01970000-0000-7000-8000-000000000003";
    await insertPerson(db, {
      id: joaoId,
      fullName: "João Lima",
      cpf: null,
      phone: "+5521912345678",
      email: "joao@example.com",
      birthDate: "1985-03-09",
      referredById: anaId,
      notes: "indicado pela Ana",
    });

    const { rows } = await client.query<{
      full_name: string;
      cpf: string | null;
      phone: string;
      email: string | null;
      birth_date: string | null;
      referred_by_id: string | null;
      notes: string | null;
      active: boolean;
      version: number;
    }>(
      "select full_name, cpf, phone, email, birth_date::text as birth_date, referred_by_id, notes, active, version from people.persons where id = $1",
      [joaoId],
    );

    expect(rows).toEqual([
      {
        full_name: "João Lima",
        cpf: null,
        phone: "+5521912345678",
        email: "joao@example.com",
        birth_date: "1985-03-09",
        referred_by_id: anaId,
        notes: "indicado pela Ana",
        active: true,
        version: 1,
      },
    ]);
  });

  it("C3 (A3): Rui Filho with same cpf as Rui is rejected", async () => {
    const ruiId = "01970000-0000-7000-8000-000000000004";
    await insertPerson(db, {
      id: ruiId,
      fullName: "Rui Alves",
      cpf: "11144477735",
      phone: "+5511900000004",
    });

    const ruiFilhoId = "01970000-0000-7000-8000-000000000005";
    // O drizzle embrulha o erro do Postgres: a mensagem externa é "Failed query: ...", o nome da constraint fica na cause.
    await expect(
      insertPerson(db, {
        id: ruiFilhoId,
        fullName: "Rui Alves Filho",
        cpf: "11144477735",
        phone: "+5511900000005",
      }),
    ).rejects.toMatchObject({
      cause: { message: expect.stringContaining("persons_cpf_key") as string },
    });
  });
});

describe("findPersonById", () => {
  let db: PgliteDatabase;
  let client: PGlite;

  beforeAll(async () => {
    ({ db, client } = await migratedTestDb());
  });

  afterAll(async () => {
    await client.close();
  });

  it("C4 (A4): Carla inserted by SQL is read with camelCase fields, defaults and createdAt as Date", async () => {
    const carlaId = "01970000-0000-7000-8000-000000000010";
    await client.query(
      "insert into people.persons (id, full_name, cpf, phone, birth_date) values ($1, $2, $3, $4, $5)",
      [carlaId, "Carla Dias", "39053344705", "+5531988887777", "1992-07-01"],
    );

    const person = await findPersonById(db, carlaId);

    expect(person).toMatchObject({
      id: carlaId,
      fullName: "Carla Dias",
      cpf: "39053344705",
      phone: "+5531988887777",
      birthDate: "1992-07-01",
      email: null,
      referredById: null,
      notes: null,
      anonymizedAt: null,
      active: true,
      version: 1,
    });
    expect(person?.createdAt).toBeInstanceOf(Date);
    expect(person?.updatedAt).toBeInstanceOf(Date);

    const snakeCaseKeys = ["full_name", "birth_date", "referred_by_id", "anonymized_at", "created_at", "updated_at"];
    for (const key of snakeCaseKeys) {
      expect(Object.keys(person ?? {})).not.toContain(key);
    }
  });

  it("C5 (A4): unknown id returns null", async () => {
    const unknownId = "01970000-0000-7000-8000-000000000099";
    const person = await findPersonById(db, unknownId);
    expect(person).toBeNull();
  });
});
