// stub E9-F02: esboço do contrato (docs/plano/E9-F02/esboco-api.txt); sai da cobertura até o E9-T03 implementar
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { PgliteDatabase } from "drizzle-orm/pglite";
export type Database = NodePgDatabase | PgliteDatabase;
export type DatabaseHandle = { readonly db: Database; close(): Promise<void> };
export const DATABASE: unique symbol = Symbol("DATABASE");
export const DATABASE_HANDLE: unique symbol = Symbol("DATABASE_HANDLE");
export function createDatabase(_databaseUrl: string): DatabaseHandle {
  throw new Error("esboço: não implementado");
}
