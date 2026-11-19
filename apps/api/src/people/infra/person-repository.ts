import { eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { persons, type PersonRow } from "./schema";

export type NewPersonRow = typeof persons.$inferInsert;

/** Insere uma pessoa; o banco valida (RN-P01: CPF único entre não nulos) e o erro sobe sem tratamento. */
export async function insertPerson(db: PgDatabase<PgQueryResultHKT>, row: NewPersonRow): Promise<void> {
  await db.insert(persons).values(row);
}

/** Lê uma pessoa por id; devolve null quando não existe. */
export async function findPersonById(db: PgDatabase<PgQueryResultHKT>, id: string): Promise<PersonRow | null> {
  const rows = await db.select().from(persons).where(eq(persons.id, id));
  return rows[0] ?? null;
}
