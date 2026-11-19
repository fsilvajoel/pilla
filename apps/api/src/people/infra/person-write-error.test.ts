import type { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migratedTestDb } from "../../db/test-db";
import { personWriteErrorCode } from "./person-write-error";

let client: PGlite;
let db: PgliteDatabase;

beforeAll(async () => {
  const migrated = await migratedTestDb();
  client = migrated.client;
  db = migrated.db;
});

afterAll(async () => {
  await client.close();
});

describe("personWriteErrorCode", () => {
  it("C5 (A5): duplicate CPF constraint gives DUPLICATE_CPF", () => {
    const error = { cause: { code: "23505", constraint: "persons_cpf_key" } };
    expect(personWriteErrorCode(error)).toBe("DUPLICATE_CPF");
  });

  it("C5 (A5): foreign key violation on referred_by_id gives NOT_FOUND", () => {
    const error = { cause: { code: "23503", constraint: "persons_referred_by_id_fkey" } };
    expect(personWriteErrorCode(error)).toBe("NOT_FOUND");
  });

  it("C5 (A5): different unique constraint gives null", () => {
    const error = { cause: { code: "23505", constraint: "outra_constraint" } };
    expect(personWriteErrorCode(error)).toBe(null);
  });

  it("C5 (A5): empty object gives null", () => {
    expect(personWriteErrorCode({})).toBe(null);
  });

  it("C6 (A6): real self-reference error gives null", async () => {
    const error = await db
      .execute(
        sql`insert into people.persons (id, full_name, phone, referred_by_id) values ('01970000-0000-7000-8000-000000000102', 'Caio Lima', '+5511987654102', '01970000-0000-7000-8000-000000000102')`,
      )
      .catch((e: unknown) => e);

    const cause = error as { cause?: { code?: string; constraint?: string } };
    expect(cause.cause?.code).toBe("23514");
    expect(cause.cause?.constraint).toBe("persons_referred_by_id_check");
    expect(personWriteErrorCode(error)).toBe(null);
  });

  it("C18 (A5): null argument gives null", () => {
    expect(personWriteErrorCode(null)).toBe(null);
  });

  it("C18 (A5): string argument gives null", () => {
    expect(personWriteErrorCode("texto")).toBe(null);
  });

  it("C18 (A5): object with null cause gives null", () => {
    expect(personWriteErrorCode({ cause: null })).toBe(null);
  });

  it("C18 (A5): object with non-object cause gives null", () => {
    expect(personWriteErrorCode({ cause: "x" })).toBe(null);
  });
});
