import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { Pool } from "pg";

export type Database = NodePgDatabase | PgliteDatabase;
export type DatabaseHandle = { readonly db: Database; close(): Promise<void> };

// Tokens de injeção: DATABASE_HANDLE (db + fechamento) e DATABASE (só o db). Testes trocam o handle por PGlite.
export const DATABASE: unique symbol = Symbol("DATABASE");
export const DATABASE_HANDLE: unique symbol = Symbol("DATABASE_HANDLE");

// O Pool só conecta na primeira consulta.
export function createDatabase(databaseUrl: string): DatabaseHandle {
  const pool = new Pool({ connectionString: databaseUrl });
  return { db: drizzle(pool), close: () => pool.end() };
}
