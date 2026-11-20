// stub E9-F02: substituído no E9-T03.
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { PgliteDatabase } from "drizzle-orm/pglite";

export type Database = NodePgDatabase | PgliteDatabase;
export type DatabaseHandle = { readonly db: Database; close(): Promise<void> };
export const DATABASE: unique symbol = Symbol("DATABASE");
export const DATABASE_HANDLE: unique symbol = Symbol("DATABASE_HANDLE");

export function createDatabase(_databaseUrl: string): DatabaseHandle {
  throw new Error("esboço: não implementado");
}
