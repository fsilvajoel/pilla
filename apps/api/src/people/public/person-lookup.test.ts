import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { migratedTestDb, type MigratedTestDb } from "../../db/test-db";
import { findPersonNames, personExists } from "./person-lookup";

const ANA_ID = "01970000-0000-7000-8000-000000000001";
const CARLOS_ID = "01970000-0000-7000-8000-000000000002";
const UNKNOWN_ID = "01970000-0000-7000-8000-000000000099";

let handle: MigratedTestDb;
let client: PGlite;

beforeAll(async () => {
  handle = await migratedTestDb();
  client = handle.client;
});
afterAll(async () => handle.close());
beforeEach(async () => {
  await client.query("delete from people.persons");
  await client.query(
    `insert into people.persons (id, full_name, cpf, phone) values
     ($1, 'Ana Costa', '52998224725', '+5511987654321'),
     ($2, 'Carlos Moraes', '11144477735', '+5511987654302')`,
    [ANA_ID, CARLOS_ID],
  );
});

describe("people public: findPersonNames", () => {
  it("C1: returns the name of each existing id", async () => {
    const names = await findPersonNames(handle.db, [ANA_ID, CARLOS_ID]);
    expect(names.get(ANA_ID)).toBe("Ana Costa");
    expect(names.get(CARLOS_ID)).toBe("Carlos Moraes");
    expect(names.size).toBe(2);
  });

  it("C2: omits an unknown id", async () => {
    const names = await findPersonNames(handle.db, [ANA_ID, UNKNOWN_ID]);
    expect([...names.keys()]).toEqual([ANA_ID]);
    expect(names.has(UNKNOWN_ID)).toBe(false);
  });

  it("returns an empty map for no ids", async () => {
    expect((await findPersonNames(handle.db, [])).size).toBe(0);
  });
});

describe("people public: personExists", () => {
  it("is true for an existing person and false for an unknown one", async () => {
    expect(await personExists(handle.db, ANA_ID)).toBe(true);
    expect(await personExists(handle.db, UNKNOWN_ID)).toBe(false);
  });
});
