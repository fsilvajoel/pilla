import type { PGlite } from "@electric-sql/pglite";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { migratedTestDb } from "../../db/test-db";
import { listPersons } from "./person-list";

describe("listPersons busca sem acento e só pontuação (E9-T06)", () => {
  let client: PGlite;
  let db: PgliteDatabase;

  beforeAll(async () => {
    ({ client, db } = await migratedTestDb());
  });

  afterAll(async () => {
    await client.close();
  });

  beforeEach(async () => {
    await client.query("delete from people.persons");
    await client.query(
      `insert into people.persons (id, full_name, cpf, phone, active) values
        ('01970000-0000-7000-8000-000000000601', 'José Conceição', '52998224725', '+5511987654601', true),
        ('01970000-0000-7000-8000-000000000602', 'Bruno Paz', null, '+5511987654602', true)`,
    );
  });

  const names = async (search: string): Promise<string[]> => {
    const page = await listPersons(db, { search, limit: 20, cursor: null, active: null });
    return page.items.map((item) => item.fullName);
  };

  it("busca com acento acha o nome acentuado", async () => {
    expect(await names("José")).toEqual(["José Conceição"]);
    expect(await names("CONCEIÇÃO")).toEqual(["José Conceição"]);
  });

  it("busca sem acento acha o nome acentuado", async () => {
    expect(await names("jose conceicao")).toEqual(["José Conceição"]);
  });

  it("busca só de pontuação vale como nome e não casa CPF", async () => {
    expect(await names("-")).toEqual([]);
    expect(await names(" . ")).toEqual([]);
  });
});
