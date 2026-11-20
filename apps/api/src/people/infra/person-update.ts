import { and, eq, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { NewPersonRow } from "./person-repository";
import { persons } from "./schema";

export type PersonChanges = Partial<
  Omit<Pick<NewPersonRow, "fullName" | "cpf" | "phone" | "email" | "birthDate" | "notes">, "cpf"> & { cpf?: string }
>;
export type UpdatePersonResult = "UPDATED" | "NOT_FOUND" | "VERSION_CONFLICT";

/** Grava as mudanças se a versão bate; soma 1 em version e põe updated_at = now(). Erro do banco sobe sem tratamento. */
export async function updatePerson(
  db: PgDatabase<PgQueryResultHKT>,
  id: string,
  expectedVersion: number,
  changes: PersonChanges,
): Promise<UpdatePersonResult> {
  const updated = await db
    .update(persons)
    .set({ ...changes, version: sql`${persons.version} + 1`, updatedAt: sql`now()` })
    .where(and(eq(persons.id, id), eq(persons.version, expectedVersion)))
    .returning({ version: persons.version });

  if (updated.length > 0) {
    return "UPDATED";
  }

  const found = await db.select({ id: persons.id }).from(persons).where(eq(persons.id, id));
  return found.length > 0 ? "VERSION_CONFLICT" : "NOT_FOUND";
}
