import { eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { persons } from "../infra/schema";

/** Id da pessoa com este CPF, ou `null`; só o id sai de `people` (E15 D1), nunca a linha. */
export async function findPersonIdByCpf(db: PgDatabase<PgQueryResultHKT>, cpf: string): Promise<string | null> {
  const rows = await db.select({ id: persons.id }).from(persons).where(eq(persons.cpf, cpf));
  return rows[0]?.id ?? null;
}
