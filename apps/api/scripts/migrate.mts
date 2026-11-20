// Aplica as migrações drizzle de todas as pastas em DATABASE_URL (RFC-005 §8). Idempotente.
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import { migrationFolders } from "../src/db/migrate.ts";

function readDatabaseUrl(): URL {
  const raw = process.env["DATABASE_URL"]?.trim() ?? "";
  if (raw === "") throw new Error("DATABASE_URL ausente ou vazia");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("DATABASE_URL inválida: esperado postgres://usuario:senha@host:porta/banco");
  }
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error("DATABASE_URL inválida: o protocolo deve ser postgres://");
  }
  return url;
}

async function main(): Promise<void> {
  const url = readDatabaseUrl();
  const pool = new pg.Pool({ connectionString: url.href });
  try {
    const db = drizzle(pool);
    for (const folder of migrationFolders) {
      await migrate(db, {
        migrationsFolder: `migrations/${folder}`,
        migrationsSchema: "drizzle",
        migrationsTable: `migrations_${folder}`,
      });
    }
    process.stdout.write(`migrações aplicadas: ${migrationFolders.join(", ")}\n`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`db:migrate falhou: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
