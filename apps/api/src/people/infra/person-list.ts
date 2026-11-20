import { and, asc, eq, or, sql, type SQL } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { persons } from "./schema";

export type PersonSummaryRow = { id: string; fullName: string; cpf: string | null; phone: string; active: boolean };
export type PersonListQuery = { search: string; limit: number; cursor: string | null; active: boolean | null };
export type PersonListPage = { items: PersonSummaryRow[]; nextCursor: string | null };

type CursorPosition = { fullName: string; id: string };

const INVALID_CURSOR = "invalid cursor";

function encodeCursor(position: CursorPosition): string {
  return Buffer.from(JSON.stringify(position), "utf8").toString("base64");
}

function decodeCursor(cursor: string): CursorPosition {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(cursor, "base64").toString("utf8"));
  } catch {
    throw new Error(INVALID_CURSOR);
  }
  const record = new Map(Object.entries<unknown>(Object.assign({}, parsed)));
  const fullName = record.get("fullName");
  const id = record.get("id");
  if (typeof fullName !== "string" || typeof id !== "string") {
    throw new Error(INVALID_CURSOR);
  }
  return { fullName, id };
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

const ACCENTED = "ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäéèêëíìîïóòôõöúùûüçñ";
const PLAIN = "AAAAAEEEEIIIIOOOOOUUUUCNaaaaaeeeeiiiiooooouuuucn";

/** Minúsculas sem acento, igual ao fold que o banco aplica em full_name (funciona no PGlite e no Postgres). */
function foldText(value: string): string {
  return Array.from(value, (char) => {
    const at = ACCENTED.indexOf(char);
    return at < 0 ? char : PLAIN.charAt(at);
  })
    .join("")
    .toLowerCase();
}

const foldedName = sql`lower(translate(${persons.fullName}, ${ACCENTED}, ${PLAIN}))`;

function searchCondition(search: string): SQL | undefined {
  const trimmed = search.trim();
  if (trimmed === "") {
    return undefined;
  }
  const byName = sql`${foldedName} like ${`%${escapeLike(foldText(trimmed))}%`}`;
  // CPF por prefixo só quando a busca é feita de dígitos e pontuação; letra junto com dígito vale só como nome.
  if (!/^[\d.\-\s]+$/.test(trimmed)) {
    return byName;
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits === "") {
    return byName;
  }
  return or(byName, sql`${persons.cpf} like ${`${digits}%`}`);
}

/** Lista pessoas com busca por nome ou CPF, ordem por lower(full_name) e id, cursor opaco e filtro de ativas. */
export async function listPersons(db: PgDatabase<PgQueryResultHKT>, query: PersonListQuery): Promise<PersonListPage> {
  const sortName = sql<string>`lower(${persons.fullName})`;
  const conditions: (SQL | undefined)[] = [searchCondition(query.search)];

  // active null = só ativas (padrão); false = só inativas.
  conditions.push(eq(persons.active, query.active ?? true));
  if (query.cursor !== null) {
    const position = decodeCursor(query.cursor);
    conditions.push(sql`(${sortName}, ${persons.id}) > (${position.fullName}, ${position.id}::uuid)`);
  }

  const rows = await db
    .select({
      id: persons.id,
      fullName: persons.fullName,
      cpf: persons.cpf,
      phone: persons.phone,
      active: persons.active,
      sortName,
    })
    .from(persons)
    .where(and(...conditions))
    .orderBy(asc(sortName), asc(persons.id))
    .limit(query.limit + 1);

  const items = rows.slice(0, query.limit).map(({ sortName: _sortName, ...item }) => item);
  const lastRow = rows[items.length - 1];
  // O cursor leva a chave lower() calculada pelo próprio Postgres (D5), nunca toLowerCase() do JS.
  const nextCursor =
    rows.length > query.limit && lastRow !== undefined
      ? encodeCursor({ fullName: lastRow.sortName, id: lastRow.id })
      : null;
  return { items, nextCursor };
}
