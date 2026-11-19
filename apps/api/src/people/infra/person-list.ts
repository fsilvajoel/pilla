// @stub E5-T16
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

export type PersonSummaryRow = { id: string; fullName: string; cpf: string | null; phone: string; active: boolean };
export type PersonListQuery = { search: string; limit: number; cursor: string | null; active: boolean | null };
export type PersonListPage = { items: PersonSummaryRow[]; nextCursor: string | null };

/** Lista pessoas com busca por nome ou CPF, ordem por lower(full_name) e id, cursor opaco e filtro de ativas. */
export function listPersons(_db: PgDatabase<PgQueryResultHKT>, _query: PersonListQuery): Promise<PersonListPage> {
  throw new Error("esboço: não implementado");
}
