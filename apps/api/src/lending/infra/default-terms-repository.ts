import { desc } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { defaultTerms, type DefaultTermsRow } from "./schema";

export type DefaultTermsInsert = typeof defaultTerms.$inferInsert;

/** Condições padrão vigentes (maior effective_from, desempate por id desc); null quando a tabela está vazia. */
export async function findCurrentDefaultTerms(db: PgDatabase<PgQueryResultHKT>): Promise<DefaultTermsRow | null> {
  const rows = await db
    .select()
    .from(defaultTerms)
    .orderBy(desc(defaultTerms.effectiveFrom), desc(defaultTerms.id))
    .limit(1);
  return rows[0] ?? null;
}

/** Nova vigência: só insere, nunca altera linha existente (ADR-0006). */
export async function insertDefaultTerms(db: PgDatabase<PgQueryResultHKT>, row: DefaultTermsInsert): Promise<void> {
  await db.insert(defaultTerms).values(row);
}
