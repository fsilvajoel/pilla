import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { and, count, eq, ne, sql } from "drizzle-orm";
import { addresses, persons, type AddressRow } from "./schema";

export type NewAddressRow = Pick<
  typeof addresses.$inferInsert,
  "id" | "personId" | "street" | "number" | "district" | "city" | "state" | "postalCode" | "isPrimary"
> & { complement?: string };
export type AddressChanges = Partial<
  Pick<NewAddressRow, "street" | "number" | "complement" | "district" | "city" | "state" | "postalCode" | "isPrimary">
>;

/** Operações de endereço dentro de uma transação; sem regra de qual endereço é o principal. */
export type AddressStore = {
  personExists(personId: string): Promise<boolean>;
  countByPerson(personId: string): Promise<number>;
  find(id: string): Promise<AddressRow | null>;
  /** Desmarca o principal da pessoa, exceto o endereço `exceptId` (quando informado). */
  clearPrimary(personId: string, exceptId: string | null): Promise<void>;
  insert(row: NewAddressRow): Promise<AddressRow>;
  update(id: string, changes: AddressChanges): Promise<AddressRow | null>;
  remove(id: string): Promise<boolean>;
};

export type AddressRepository = { inTransaction<T>(work: (store: AddressStore) => Promise<T>): Promise<T> };

function storeOf(tx: Pick<PgDatabase<PgQueryResultHKT>, "select" | "insert" | "update" | "delete">): AddressStore {
  return {
    async personExists(personId) {
      const rows = await tx.select({ id: persons.id }).from(persons).where(eq(persons.id, personId));
      return rows.length > 0;
    },
    async countByPerson(personId) {
      const rows = await tx.select({ total: count() }).from(addresses).where(eq(addresses.personId, personId));
      return rows[0]?.total ?? 0;
    },
    async find(id) {
      const rows = await tx.select().from(addresses).where(eq(addresses.id, id));
      return rows[0] ?? null;
    },
    async clearPrimary(personId, exceptId) {
      const owner = and(eq(addresses.personId, personId), eq(addresses.isPrimary, true));
      await tx
        .update(addresses)
        .set({ isPrimary: false })
        .where(exceptId === null ? owner : and(owner, ne(addresses.id, exceptId)));
    },
    async insert(row) {
      const rows = await tx.insert(addresses).values(row).returning();
      const inserted = rows[0];
      if (inserted === undefined) throw new Error("address insert returned no row");
      return inserted;
    },
    async update(id, changes) {
      const rows = await tx
        .update(addresses)
        .set({ ...changes, updatedAt: sql`now()` })
        .where(eq(addresses.id, id))
        .returning();
      return rows[0] ?? null;
    },
    async remove(id) {
      const rows = await tx.delete(addresses).where(eq(addresses.id, id)).returning({ id: addresses.id });
      return rows.length > 0;
    },
  };
}

export function addressRepository(db: PgDatabase<PgQueryResultHKT>): AddressRepository {
  return { inTransaction: (work) => db.transaction((tx) => work(storeOf(tx))) };
}
