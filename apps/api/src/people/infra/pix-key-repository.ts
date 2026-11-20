import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { and, count, eq, ne, sql } from "drizzle-orm";
import { persons, pixKeys, type PixKeyRow } from "./schema";

export type NewPixKeyRow = Pick<typeof pixKeys.$inferInsert, "id" | "ownerPersonId" | "type" | "value" | "isPrimary">;
export type PixKeyChanges = Partial<Pick<NewPixKeyRow, "type" | "value" | "isPrimary">>;

/** Operações de chave PIX dentro de uma transação; sem regra de qual chave é a principal. */
export type PixKeyStore = {
  personExists(personId: string): Promise<boolean>;
  countByPerson(personId: string): Promise<number>;
  find(id: string): Promise<PixKeyRow | null>;
  /** Desmarca a principal da pessoa, exceto a chave `exceptId` (quando informada). */
  clearPrimary(personId: string, exceptId: string | null): Promise<void>;
  insert(row: NewPixKeyRow): Promise<PixKeyRow>;
  update(id: string, changes: PixKeyChanges): Promise<PixKeyRow | null>;
  remove(id: string): Promise<boolean>;
};

export type PixKeyRepository = { inTransaction<T>(work: (store: PixKeyStore) => Promise<T>): Promise<T> };

function storeOf(tx: Pick<PgDatabase<PgQueryResultHKT>, "select" | "insert" | "update" | "delete">): PixKeyStore {
  return {
    async personExists(personId) {
      const rows = await tx.select({ id: persons.id }).from(persons).where(eq(persons.id, personId));
      return rows.length > 0;
    },
    async countByPerson(personId) {
      const rows = await tx.select({ total: count() }).from(pixKeys).where(eq(pixKeys.ownerPersonId, personId));
      return rows[0]?.total ?? 0;
    },
    async find(id) {
      const rows = await tx.select().from(pixKeys).where(eq(pixKeys.id, id));
      return rows[0] ?? null;
    },
    async clearPrimary(personId, exceptId) {
      const owner = and(eq(pixKeys.ownerPersonId, personId), eq(pixKeys.isPrimary, true));
      await tx
        .update(pixKeys)
        .set({ isPrimary: false })
        .where(exceptId === null ? owner : and(owner, ne(pixKeys.id, exceptId)));
    },
    async insert(row) {
      const rows = await tx.insert(pixKeys).values(row).returning();
      const inserted = rows[0];
      if (inserted === undefined) throw new Error("pix key insert returned no row");
      return inserted;
    },
    async update(id, changes) {
      const rows = await tx
        .update(pixKeys)
        .set({ ...changes, updatedAt: sql`now()` })
        .where(eq(pixKeys.id, id))
        .returning();
      return rows[0] ?? null;
    },
    async remove(id) {
      const rows = await tx.delete(pixKeys).where(eq(pixKeys.id, id)).returning({ id: pixKeys.id });
      return rows.length > 0;
    },
  };
}

export function pixKeyRepository(db: PgDatabase<PgQueryResultHKT>): PixKeyRepository {
  return { inTransaction: (work) => db.transaction((tx) => work(storeOf(tx))) };
}
