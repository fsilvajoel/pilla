// Provider de banco da API: pool do pg + drizzle. O Pool só conecta na primeira consulta.
import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { Pool } from "pg";

export type Database = NodePgDatabase | PgliteDatabase;
export type DatabaseHandle = { readonly db: Database; close(): Promise<void> };
export const DATABASE: unique symbol = Symbol("DATABASE");
export const DATABASE_HANDLE: unique symbol = Symbol("DATABASE_HANDLE");

export function createDatabase(databaseUrl: string): DatabaseHandle {
  const pool = new Pool({ connectionString: databaseUrl });
  return {
    db: drizzle({ client: pool }),
    close: () => pool.end(),
  };
}
