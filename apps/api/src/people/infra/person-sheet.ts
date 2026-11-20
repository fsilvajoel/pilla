import { asc, desc, eq, sql } from "drizzle-orm";
import { alias, type PgDatabase, type PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { PersonSummaryRow } from "./person-list";
import { addresses, persons, pixKeys, type AddressRow, type PersonRow, type PixKeyRow } from "./schema";

export type PersonSheetRows = {
  person: PersonRow;
  referrer: PersonSummaryRow | null;
  referrals: PersonSummaryRow[];
  addresses: AddressRow[];
  pixKeys: PixKeyRow[];
};

/**
 * Lê a ficha da pessoa em 4 consultas (pessoa com indicador, indicados, endereços, chaves Pix), sem N+1.
 * Devolve null quando a pessoa não existe.
 */
export async function findPersonSheet(db: PgDatabase<PgQueryResultHKT>, id: string): Promise<PersonSheetRows | null> {
  const referrer = alias(persons, "referrer");
  const [head] = await db
    .select({
      person: persons,
      referrer: {
        id: referrer.id,
        fullName: referrer.fullName,
        cpf: referrer.cpf,
        phone: referrer.phone,
        active: referrer.active,
      },
    })
    .from(persons)
    .leftJoin(referrer, eq(referrer.id, persons.referredById))
    .where(eq(persons.id, id));
  if (head === undefined) return null;

  const [referrals, addressRows, pixKeyRows] = await Promise.all([
    db
      .select({
        id: persons.id,
        fullName: persons.fullName,
        cpf: persons.cpf,
        phone: persons.phone,
        active: persons.active,
      })
      .from(persons)
      .where(eq(persons.referredById, id))
      .orderBy(asc(sql`lower(${persons.fullName})`), asc(persons.id)),
    db
      .select()
      .from(addresses)
      .where(eq(addresses.personId, id))
      .orderBy(desc(addresses.isPrimary), asc(addresses.createdAt), asc(addresses.id)),
    db
      .select()
      .from(pixKeys)
      .where(eq(pixKeys.ownerPersonId, id))
      .orderBy(desc(pixKeys.isPrimary), asc(pixKeys.createdAt), asc(pixKeys.id)),
  ]);

  return { person: head.person, referrer: head.referrer, referrals, addresses: addressRows, pixKeys: pixKeyRows };
}
