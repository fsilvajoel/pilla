// @stub E5-T06
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { persons, type PersonRow } from "./schema";

export type NewPersonRow = typeof persons.$inferInsert;

/** Insere uma pessoa; o banco valida e o erro sobe sem tratamento. */
export function insertPerson(_db: PgDatabase<PgQueryResultHKT>, _row: NewPersonRow): Promise<void> {
  throw new Error("esboço: não implementado");
}

/** Lê uma pessoa por id; devolve null quando não existe. */
export function findPersonById(_db: PgDatabase<PgQueryResultHKT>, _id: string): Promise<PersonRow | null> {
  throw new Error("esboço: não implementado");
}
