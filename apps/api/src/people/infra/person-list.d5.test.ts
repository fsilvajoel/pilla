import type { PGlite } from "@electric-sql/pglite";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { migratedTestDb } from "../../db/test-db";
import { listPersons } from "./person-list";

describe("listPersons cursor com caracteres não ASCII (D5)", () => {
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

  const insertPerson = async (id: string, fullName: string, phone: string) => {
    await client.query(
      `insert into people.persons (id, full_name, cpf, phone, active) values ($1, $2, null, $3, true)`,
      [id, fullName, phone],
    );
  };

  it("C1 (D5): paginar de 1 em 1 devolve cada pessoa uma vez, sem pular nem repetir", async () => {
    // Sigma final: lower() do Postgres dá "ασ"; toLowerCase() do JS dá "ας" (outro valor).
    await insertPerson("01970000-0000-7000-8000-000000000501", "ΟΔΥΣΣΕΑΣ", "+5511987654501");
    await insertPerson("01970000-0000-7000-8000-000000000502", "Ωμέγα Souza", "+5511987654502");
    await insertPerson("01970000-0000-7000-8000-000000000503", "Éder Lima", "+5511987654503");
    await insertPerson("01970000-0000-7000-8000-000000000504", "Bruno Paz", "+5511987654504");

    const seen: string[] = [];
    let cursor: string | null = null;
    for (let page = 0; page < 10; page += 1) {
      const result = await listPersons(db, { search: "", limit: 1, cursor, active: null });
      seen.push(...result.items.map((item) => item.fullName));
      cursor = result.nextCursor;
      if (cursor === null) {
        break;
      }
    }

    expect(seen).toHaveLength(4);
    expect([...seen].sort()).toEqual(["Bruno Paz", "Ωμέγα Souza", "ΟΔΥΣΣΕΑΣ", "Éder Lima"].sort());
  });
});
