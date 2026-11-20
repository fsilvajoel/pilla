import type { PGlite, Results } from "@electric-sql/pglite";

// Leitura do contrato físico de uma tabela pelo catálogo do PostgreSQL, para os testes de tabela (RFC-005).
// O contrato é conferido em SQL e não depende dos nomes TypeScript do schema.ts.

type Column = {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
};

/** Uma linha por coluna, em ordem alfabética: `nome tipo null|not null[ default x]`. */
export async function columnsOf(client: PGlite, schema: string, table: string): Promise<string[]> {
  const { rows } = await client.query<Column>(
    `select column_name, data_type, is_nullable, column_default
       from information_schema.columns where table_schema = $1 and table_name = $2 order by column_name`,
    [schema, table],
  );
  return rows.map((c) => {
    const nullable = c.is_nullable === "YES" ? "null" : "not null";
    const fallback = c.column_default === null ? "" : ` default ${c.column_default}`;
    return `${c.column_name} ${c.data_type} ${nullable}${fallback}`;
  });
}

/** Definição de cada índice da tabela, em ordem de nome. */
export async function indexesOf(client: PGlite, schema: string, table: string): Promise<string[]> {
  const { rows } = await client.query<{ indexdef: string }>(
    "select indexdef from pg_indexes where schemaname = $1 and tablename = $2 order by indexname",
    [schema, table],
  );
  return rows.map((r) => r.indexdef);
}

/** Insere uma linha com as colunas dadas e devolve a linha gravada (com os padrões do banco). */
export function insertRow<T>(client: PGlite, table: string, row: Record<string, unknown>): Promise<Results<T>> {
  const cols = Object.keys(row);
  const params = cols.map((_, i) => `$${String(i + 1)}`);
  return client.query<T>(
    `insert into ${table} (${cols.join(", ")}) values (${params.join(", ")}) returning *`,
    Object.values(row),
  );
}

/** Gerador de uuid v7 de teste, previsível e sem repetição dentro do arquivo. */
export function testIds(prefix = "01970000-0000-7000-8000-"): () => string {
  let seq = 0;
  return () => `${prefix}${String(++seq).padStart(12, "0")}`;
}
