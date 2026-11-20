import type { PGlite } from "@electric-sql/pglite";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { migratedTestDb } from "../../db/test-db";
import { listPersons } from "./person-list";

describe("listPersons (C7-C17, C19)", () => {
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
  });

  const insertPerson = async (id: string, fullName: string, cpf: string | null, phone: string, active: boolean) => {
    await client.query(`insert into people.persons (id, full_name, cpf, phone, active) values ($1, $2, $3, $4, $5)`, [
      id,
      fullName,
      cpf,
      phone,
      active,
    ]);
  };

  it("treats a search of only punctuation as a name search with no digits", async () => {
    await insertPerson("01970000-0000-7000-8000-000000000201", "Caio Lima", "52998224725", "+5511987654201", true);

    const result = await listPersons(db, { search: " . - ", limit: 20, cursor: null, active: null });

    expect(result).toEqual({ items: [], nextCursor: null });
  });

  it("C7 (A7): returns exactly the item with null cpf", async () => {
    await insertPerson("01970000-0000-7000-8000-000000000200", "Caio Lima", null, "+5511987654200", true);

    const result = await listPersons(db, { search: "", limit: 20, cursor: null, active: null });

    expect(result).toEqual({
      items: [
        {
          id: "01970000-0000-7000-8000-000000000200",
          fullName: "Caio Lima",
          cpf: null,
          phone: "+5511987654200",
          active: true,
        },
      ],
      nextCursor: null,
    });
  });

  it("C8 (A8): empty database returns empty items and null nextCursor", async () => {
    const result = await listPersons(db, { search: "", limit: 20, cursor: null, active: null });

    expect(result).toEqual({ items: [], nextCursor: null });
  });

  it("C11 (A10): search 'BIA' returns Bia Nunes and bia santos in lower-name order with null nextCursor; second search 'SANTOS' returns only bia santos", async () => {
    await insertPerson("01970000-0000-7000-8000-000000000204", "Ana Costa", "52998224725", "+5511987654204", true);
    await insertPerson("01970000-0000-7000-8000-000000000205", "Bia Nunes", "11144477735", "+5511987654205", true);
    await insertPerson("01970000-0000-7000-8000-000000000206", "bia santos", "39053344705", "+5511987654206", true);

    const result = await listPersons(db, { search: "BIA", limit: 20, cursor: null, active: null });

    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toEqual({
      id: "01970000-0000-7000-8000-000000000205",
      fullName: "Bia Nunes",
      cpf: "11144477735",
      phone: "+5511987654205",
      active: true,
    });
    expect(result.items[1]).toEqual({
      id: "01970000-0000-7000-8000-000000000206",
      fullName: "bia santos",
      cpf: "39053344705",
      phone: "+5511987654206",
      active: true,
    });
    expect(result.nextCursor).toBeNull();

    // Second search "SANTOS" (upper case on purpose, matches "bia santos" in the middle of the name)
    const resultSantos = await listPersons(db, { search: "SANTOS", limit: 20, cursor: null, active: null });

    expect(resultSantos.items).toHaveLength(1);
    expect(resultSantos.items[0]).toEqual({
      id: "01970000-0000-7000-8000-000000000206",
      fullName: "bia santos",
      cpf: "39053344705",
      phone: "+5511987654206",
      active: true,
    });
    expect(resultSantos.nextCursor).toBeNull();
  });

  it("C12 (A11): search CPF '529.982.247-25' returns exactly Ana CPF with null nextCursor; partial prefix '529982' gives only Ana CPF; middle digits '982247' gives empty", async () => {
    await insertPerson("01970000-0000-7000-8000-000000000207", "Ana CPF", "52998224725", "+5511987654207", true);
    await insertPerson("01970000-0000-7000-8000-000000000208", "Bia CPF", "11144477735", "+5511987654208", true);

    const result = await listPersons(db, { search: "529.982.247-25", limit: 20, cursor: null, active: null });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toEqual({
      id: "01970000-0000-7000-8000-000000000207",
      fullName: "Ana CPF",
      cpf: "52998224725",
      phone: "+5511987654207",
      active: true,
    });
    expect(result.nextCursor).toBeNull();

    // Partial prefix "529982" gives only Ana CPF 0207 (not Bia CPF)
    const resultPartial = await listPersons(db, { search: "529982", limit: 20, cursor: null, active: null });

    expect(resultPartial.items).toHaveLength(1);
    expect(resultPartial.items[0]).toEqual({
      id: "01970000-0000-7000-8000-000000000207",
      fullName: "Ana CPF",
      cpf: "52998224725",
      phone: "+5511987654207",
      active: true,
    });
    expect(resultPartial.nextCursor).toBeNull();

    // Middle digits "982247" gives empty
    const resultMiddle = await listPersons(db, { search: "982247", limit: 20, cursor: null, active: null });

    expect(resultMiddle).toEqual({ items: [], nextCursor: null });
  });

  it("C13 (A12): returns four people in lower(full_name), id order with null nextCursor", async () => {
    // Insert in physical order: 0211, 0210, 0209, 0212
    await insertPerson("01970000-0000-7000-8000-000000000211", "Ana Souza", "39053344705", "+5511987654211", true);
    await insertPerson("01970000-0000-7000-8000-000000000210", "Ana Souza", "11144477735", "+5511987654210", true);
    await insertPerson("01970000-0000-7000-8000-000000000209", "Bruno Lima", "52998224725", "+5511987654209", true);
    await insertPerson("01970000-0000-7000-8000-000000000212", "ana lima", null, "+5511987654212", true);

    const result = await listPersons(db, { search: "", limit: 20, cursor: null, active: null });

    expect(result.items).toHaveLength(4);
    // Order by lower(full_name), then id:
    // "ana lima" (0212) < "ana souza" (0210) < "ana souza" (0211) < "bruno lima" (0209)
    expect(result.items[0]).toEqual({
      id: "01970000-0000-7000-8000-000000000212",
      fullName: "ana lima",
      cpf: null,
      phone: "+5511987654212",
      active: true,
    });
    expect(result.items[1]).toEqual({
      id: "01970000-0000-7000-8000-000000000210",
      fullName: "Ana Souza",
      cpf: "11144477735",
      phone: "+5511987654210",
      active: true,
    });
    expect(result.items[2]).toEqual({
      id: "01970000-0000-7000-8000-000000000211",
      fullName: "Ana Souza",
      cpf: "39053344705",
      phone: "+5511987654211",
      active: true,
    });
    expect(result.items[3]).toEqual({
      id: "01970000-0000-7000-8000-000000000209",
      fullName: "Bruno Lima",
      cpf: "52998224725",
      phone: "+5511987654209",
      active: true,
    });
    expect(result.nextCursor).toBeNull();
  });

  it("C14 (A9, A13): pagination with limit 1 follows cursor through three pages with name order disagreeing with id order", async () => {
    // By id order: Eva Reis (213), Davi Melo (214), Bia Nunes (219)
    // By name order: Bia Nunes (219), Davi Melo (214), Eva Reis (213)
    await insertPerson("01970000-0000-7000-8000-000000000219", "Bia Nunes", "52998224725", "+5511987654219", true);
    await insertPerson("01970000-0000-7000-8000-000000000214", "Davi Melo", "11144477735", "+5511987654214", true);
    await insertPerson("01970000-0000-7000-8000-000000000213", "Eva Reis", "39053344705", "+5511987654213", true);

    const page1 = await listPersons(db, { search: "", limit: 1, cursor: null, active: null });

    expect(page1.items).toHaveLength(1);
    expect(page1.items[0]).toEqual({
      id: "01970000-0000-7000-8000-000000000219",
      fullName: "Bia Nunes",
      cpf: "52998224725",
      phone: "+5511987654219",
      active: true,
    });
    expect(page1.nextCursor).not.toBeNull();

    const page2 = await listPersons(db, { search: "", limit: 1, cursor: page1.nextCursor, active: null });

    expect(page2.items).toHaveLength(1);
    expect(page2.items[0]).toEqual({
      id: "01970000-0000-7000-8000-000000000214",
      fullName: "Davi Melo",
      cpf: "11144477735",
      phone: "+5511987654214",
      active: true,
    });
    expect(page2.nextCursor).not.toBeNull();

    const page3 = await listPersons(db, { search: "", limit: 1, cursor: page2.nextCursor, active: null });

    expect(page3.items).toHaveLength(1);
    expect(page3.items[0]).toEqual({
      id: "01970000-0000-7000-8000-000000000213",
      fullName: "Eva Reis",
      cpf: "39053344705",
      phone: "+5511987654213",
      active: true,
    });
    expect(page3.nextCursor).toBeNull();

    // Verify complete sequence: Bia, Davi, Eva with no repeat and no gap
    const allItems = [...page1.items, ...page2.items, ...page3.items];
    expect(allItems.map((i) => i.id)).toEqual([
      "01970000-0000-7000-8000-000000000219",
      "01970000-0000-7000-8000-000000000214",
      "01970000-0000-7000-8000-000000000213",
    ]);
  });

  it("C15 (A14): active null and true return only active person; active false returns only inactive person", async () => {
    await insertPerson("01970000-0000-7000-8000-000000000215", "Ativa Silva", "52998224725", "+5511987654215", true);
    await insertPerson("01970000-0000-7000-8000-000000000216", "Inativa Souza", "39053344705", "+5511987654216", false);

    const resultNull = await listPersons(db, { search: "", limit: 20, cursor: null, active: null });
    const resultTrue = await listPersons(db, { search: "", limit: 20, cursor: null, active: true });
    const resultFalse = await listPersons(db, { search: "", limit: 20, cursor: null, active: false });

    expect(resultNull.items).toHaveLength(1);
    expect(resultNull.items[0]).toEqual({
      id: "01970000-0000-7000-8000-000000000215",
      fullName: "Ativa Silva",
      cpf: "52998224725",
      phone: "+5511987654215",
      active: true,
    });
    expect(resultNull.nextCursor).toBeNull();

    expect(resultTrue.items).toHaveLength(1);
    expect(resultTrue.items[0]).toEqual({
      id: "01970000-0000-7000-8000-000000000215",
      fullName: "Ativa Silva",
      cpf: "52998224725",
      phone: "+5511987654215",
      active: true,
    });
    expect(resultTrue.nextCursor).toBeNull();

    expect(resultFalse.items).toHaveLength(1);
    expect(resultFalse.items[0]).toEqual({
      id: "01970000-0000-7000-8000-000000000216",
      fullName: "Inativa Souza",
      cpf: "39053344705",
      phone: "+5511987654216",
      active: false,
    });
    expect(resultFalse.nextCursor).toBeNull();
  });

  it("C17 (A16): search '529' returns Ana CPF 0218 then Lote 529 Silva 0217 (name contains OR CPF prefix)", async () => {
    // Insert in order: 0217 first, then 0218
    await insertPerson("01970000-0000-7000-8000-000000000217", "Lote 529 Silva", "11144477735", "+5511987654217", true);
    await insertPerson("01970000-0000-7000-8000-000000000218", "Ana CPF", "52998224725", "+5511987654218", true);

    const result = await listPersons(db, { search: "529", limit: 20, cursor: null, active: null });

    expect(result.items).toHaveLength(2);
    // Order by lower(full_name), then id:
    // "ana cpf" (0218) < "lote 529 silva" (0217)
    expect(result.items[0]).toEqual({
      id: "01970000-0000-7000-8000-000000000218",
      fullName: "Ana CPF",
      cpf: "52998224725",
      phone: "+5511987654218",
      active: true,
    });
    expect(result.items[1]).toEqual({
      id: "01970000-0000-7000-8000-000000000217",
      fullName: "Lote 529 Silva",
      cpf: "11144477735",
      phone: "+5511987654217",
      active: true,
    });
    expect(result.nextCursor).toBeNull();
  });

  it("C19 (A17): each malformed cursor rejects with exact message 'invalid cursor'", async () => {
    const malformedCursors = [
      "abc",
      "bm90IGpzb24=", // base64 of "not json"
      "eyJmdWxsTmFtZSI6ImFuYSJ9", // base64 of {"fullName":"ana"} (no id)
      "eyJmdWxsTmFtZSI6MSwiaWQiOiJ4In0=", // base64 of {"fullName":1,"id":"x"} (fullName not string)
    ];

    for (const cursor of malformedCursors) {
      await expect(listPersons(db, { search: "", limit: 20, cursor, active: null })).rejects.toThrow("invalid cursor");
    }
  });
});
