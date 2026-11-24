import { eq, inArray } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { Database } from "../../db/database";
import { persons } from "../infra/schema";

/** Nome de cada pessoa existente, por id; ids desconhecidos ficam de fora. */
export async function findPersonNames(db: Database, ids: readonly string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({ id: persons.id, fullName: persons.fullName })
    .from(persons)
    .where(inArray(persons.id, [...ids]));
  return new Map(rows.map((row) => [row.id, row.fullName]));
}

/** Diz se a pessoa existe. */
export async function personExists(db: Database, id: string): Promise<boolean> {
  const rows = await db.select({ id: persons.id }).from(persons).where(eq(persons.id, id));
  return rows.length > 0;
}

/** Diz se a pessoa tem CPF cadastrado; `null` quando a pessoa não existe. Só o fato sai de `people`, nunca o CPF. */
export async function personHasCpf(db: PgDatabase<PgQueryResultHKT>, id: string): Promise<boolean | null> {
  const rows = await db.select({ cpf: persons.cpf }).from(persons).where(eq(persons.id, id));
  const row = rows[0];
  return row === undefined ? null : row.cpf !== null;
}
