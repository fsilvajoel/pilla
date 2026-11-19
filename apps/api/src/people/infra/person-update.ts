// @stub E5-T12
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { NewPersonRow } from "./person-repository";

export type PersonChanges = Partial<
  Omit<Pick<NewPersonRow, "fullName" | "cpf" | "phone" | "email" | "birthDate" | "notes">, "cpf"> & { cpf?: string }
>;
export type UpdatePersonResult = "UPDATED" | "NOT_FOUND" | "VERSION_CONFLICT";

/** Grava as mudanças se a versão bate; soma 1 em version e põe updated_at = now(). Erro do banco sobe sem tratamento. */
export function updatePerson(
  _db: PgDatabase<PgQueryResultHKT>,
  _id: string,
  _expectedVersion: number,
  _changes: PersonChanges,
): Promise<UpdatePersonResult> {
  throw new Error("esboço: não implementado");
}
