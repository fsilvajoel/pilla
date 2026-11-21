import { desc } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { defaultTerms, type DefaultTermsRow } from "./schema";

/** Condições padrão vigentes (maior effective_from); null quando a tabela está vazia. */
export async function findCurrentDefaultTerms(db: PgDatabase<PgQueryResultHKT>): Promise<DefaultTermsRow | null> {
  const rows = await db.select().from(defaultTerms).orderBy(desc(defaultTerms.effectiveFrom)).limit(1);
  return rows[0] ?? null;
}
