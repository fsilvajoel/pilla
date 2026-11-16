import type { PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

// Ordem de aplicação das pastas de migração (RFC-005 §8). Módulo novo entra aqui e em drizzle-kit/.
export const migrationFolders = ["core", "people", "lending", "payments", "treasury", "access"] as const;

// Relativo à raiz do pacote (apps/api), que é o diretório de trabalho de testes e processos.
const migrationsRoot = "migrations/";

// Aplica todas as migrações; cada pasta tem a própria tabela de controle no schema `drizzle`.
export async function migrateAll(db: PgliteDatabase): Promise<void> {
  for (const folder of migrationFolders) {
    await migrate(db, {
      migrationsFolder: migrationsRoot + folder,
      migrationsSchema: "drizzle",
      migrationsTable: `migrations_${folder}`,
    });
  }
}
