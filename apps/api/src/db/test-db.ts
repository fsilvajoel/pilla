import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrateAll } from "./migrate";

export type MigratedTestDb = { db: PgliteDatabase; client: PGlite; close(): Promise<void> };

// Banco de teste: PostgreSQL em processo (PGlite), vazio, com todas as migrações aplicadas.
// O close() é idempotente: fechar duas vezes não lança.
export async function migratedTestDb(): Promise<MigratedTestDb> {
  const client = new PGlite();
  const db = drizzle({ client });
  await migrateAll(db);
  let closed = false;
  return {
    db,
    client,
    close: async (): Promise<void> => {
      if (closed) return;
      closed = true;
      await client.close();
    },
  };
}
