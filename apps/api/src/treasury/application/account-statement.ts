import {
  accountStatementEntry,
  idSchema,
  type AccountStatementQuery,
  type AccountStatementResponse,
} from "@pilla/schemas";
import type { Database } from "../../db/database";
import { ProblemException } from "../../core/http/problem-exception";
import {
  accountExists,
  balanceBefore,
  balanceUpTo,
  ledgerEntryExists,
  selectStatementPage,
} from "../infra/ledger-statement";

function invalid(field: string, message: string): ProblemException {
  return new ProblemException("VALIDATION_FAILED", "Dados inválidos.", [{ field, message }]);
}

/** Cursor opaco: id do último lançamento da página em base64url. */
const encodeCursor = (id: string): string => Buffer.from(id, "utf8").toString("base64url");

/** Só aceita o que `encodeCursor` produz: o texto precisa voltar idêntico, senão foi adulterado. */
function decodeCursor(cursor: string): string {
  const id = idSchema.safeParse(Buffer.from(cursor, "base64url").toString("utf8"));
  if (!id.success || encodeCursor(id.data) !== cursor) throw invalid("cursor", "Cursor inválido.");
  return id.data;
}

/** Extrato da conta (RF-31): saldos derivados do ledger (ADR-0005), nunca gravados. */
export async function accountStatement(
  db: Database,
  accountId: string,
  query: AccountStatementQuery,
): Promise<AccountStatementResponse> {
  const from = query.from ?? null;
  const to = query.to ?? null;
  // Um snapshot só: abertura, fechamento e página não podem enxergar gravações diferentes (o fechamento tem que
  // bater com o `balanceAfterCents` do último item).
  const { openingBalanceCents, closingBalanceCents, rows } = await db.transaction(
    async (tx) => {
      if (!(await accountExists(tx, accountId))) throw new ProblemException("NOT_FOUND", "Recurso não encontrado.");
      const afterId = query.cursor === undefined ? null : decodeCursor(query.cursor);
      if (afterId !== null && !(await ledgerEntryExists(tx, accountId, afterId))) {
        throw invalid("cursor", "Cursor inválido.");
      }
      return {
        openingBalanceCents: from === null ? 0 : await balanceBefore(tx, accountId, from),
        closingBalanceCents: await balanceUpTo(tx, accountId, to),
        rows: await selectStatementPage(tx, { accountId, from, to, limit: query.limit, afterId }),
      };
    },
    { isolationLevel: "repeatable read" },
  );
  const page = rows.slice(0, query.limit);
  const last = page.at(-1);
  return {
    accountId,
    from,
    to,
    openingBalanceCents,
    closingBalanceCents,
    // O parse confere o que o CHECK do banco já garante (tipo, componente, origem) e dá o tipo estreito sem asserção.
    items: page.map((row) => accountStatementEntry.parse({ ...row, createdAt: row.createdAt.toISOString() })),
    nextCursor: rows.length > query.limit && last !== undefined ? encodeCursor(last.id) : null,
  };
}
