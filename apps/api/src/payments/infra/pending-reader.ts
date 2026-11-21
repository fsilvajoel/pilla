import { paymentMethodSchema, type PendingPaymentsSummary } from "@pilla/schemas";
import { asc, eq, getTableColumns, sql } from "drizzle-orm";
import type { Database } from "../../db/database";
import { payments } from "./schema";

/**
 * Pendentes de conferência (índice payments_pending_review_idx): os `limit` mais antigos e, na mesma consulta,
 * a contagem e a soma de todos (janela sobre o filtro, antes do limite).
 */
export async function readPendingReview(db: Database, limit: number): Promise<PendingPaymentsSummary> {
  const rows = await db
    .select({
      ...getTableColumns(payments),
      pendingCount: sql<string>`count(*) over ()`,
      pendingTotal: sql<string>`sum(${payments.amountCents}) over ()`,
    })
    .from(payments)
    .where(eq(payments.status, "PENDING_REVIEW"))
    .orderBy(asc(payments.createdAt), asc(payments.id))
    .limit(limit);
  return {
    count: Number(rows[0]?.pendingCount ?? 0),
    totalCents: Number(rows[0]?.pendingTotal ?? 0),
    items: rows.map((row) => ({
      id: row.id,
      loanId: row.loanId,
      personId: row.personId,
      accountId: row.accountId,
      paidAt: row.paidAt,
      amountCents: row.amountCents,
      method: paymentMethodSchema.parse(row.method),
      registeredAt: row.createdAt.toISOString(),
    })),
  };
}
