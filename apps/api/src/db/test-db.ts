import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrateAll } from "./migrate";

// Banco de teste: PostgreSQL em processo (PGlite), vazio, com todas as migrações aplicadas.
export async function migratedTestDb(): Promise<{ db: PgliteDatabase; client: PGlite }> {
  const client = new PGlite();
  const db = drizzle({ client });
  await migrateAll(db);
  return { db, client };
}
