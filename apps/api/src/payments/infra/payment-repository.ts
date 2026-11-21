import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";
import { recordAudit, type AuditEntry } from "../../core/public/audit";
import type { Database } from "../../db/database";
import { payments, type PaymentRow } from "./schema";

export type NewPaymentRow = typeof payments.$inferInsert;

/** Filtros e página de GET /payments (já validados); `afterId` é o último item da página anterior. */
export type PaymentPageParams = {
  readonly status: string | null;
  readonly loanId: string | null;
  readonly limit: number;
  readonly afterId: string | null;
};

/** Pagamento com a Idempotency-Key dada, se houver (E11 D8). */
export async function findPaymentByIdempotencyKey(db: Database, key: string): Promise<PaymentRow | null> {
  const rows = await db.select().from(payments).where(eq(payments.idempotencyKey, key));
  return rows[0] ?? null;
}

/**
 * Grava o pagamento e a auditoria na mesma transação. Se a Idempotency-Key já existe (outra requisição gravou
 * primeiro), a chave única do banco devolve a linha guardada e nada mais é gravado.
 */
export function insertPaymentWithAudit(
  db: Database,
  row: NewPaymentRow,
  auditOf: (stored: PaymentRow) => AuditEntry,
): Promise<PaymentRow> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .insert(payments)
      .values(row)
      .onConflictDoUpdate({
        target: payments.idempotencyKey,
        set: { idempotencyKey: sql`excluded.idempotency_key` },
      })
      .returning();
    const stored = rows[0];
    if (stored === undefined) throw new Error("payment insert returned no row");
    if (stored.id === row.id) await recordAudit(tx, auditOf(stored));
    return stored;
  });
}

// Fila de conferência primeiro (0), depois os demais (1).
const rankOf = sql`(case when ${payments.status} = 'PENDING_REVIEW' then 0 else 1 end)`;

/**
 * Página de pagamentos (RFC-004 §3). Ordem: PENDING_REVIEW do mais antigo para o mais novo, depois os demais do
 * mais novo para o mais antigo; empate pelo id. O cursor é o id do último item: a posição dele sai do próprio banco,
 * sem perder a precisão do instante. Lê `limit + 1` linhas para saber se há próxima página.
 */
export async function selectPaymentPage(db: Database, params: PaymentPageParams): Promise<PaymentRow[]> {
  const conditions: (SQL | undefined)[] = [
    params.status === null ? undefined : eq(payments.status, params.status),
    params.loanId === null ? undefined : eq(payments.loanId, params.loanId),
  ];
  if (params.afterId !== null) {
    const id = params.afterId;
    const anchorRank = sql`(select case when status = 'PENDING_REVIEW' then 0 else 1 end from payments.payments where id = ${id})`;
    const anchorAt = sql`(select created_at from payments.payments where id = ${id})`;
    const here = sql`(${payments.createdAt}, ${payments.id})`;
    const anchor = sql`(${anchorAt}, ${id}::uuid)`;
    conditions.push(
      sql`(${rankOf} > ${anchorRank} or (${rankOf} = ${anchorRank} and (
        (${rankOf} = 0 and ${here} > ${anchor}) or (${rankOf} = 1 and ${here} < ${anchor}))))`,
    );
  }
  const pending = sql`${payments.status} = 'PENDING_REVIEW'`;
  return db
    .select()
    .from(payments)
    .where(and(...conditions))
    .orderBy(
      asc(rankOf),
      asc(sql`case when ${pending} then ${payments.createdAt} end`),
      desc(sql`case when not ${pending} then ${payments.createdAt} end`),
      asc(sql`case when ${pending} then ${payments.id} end`),
      desc(sql`case when not ${pending} then ${payments.id} end`),
    )
    .limit(params.limit + 1);
}
