import { eq, sql } from "drizzle-orm";
import type { AuditEntry } from "../../core/public/audit";
import { recordAudit } from "../../core/public/audit";
import type { Database } from "../../db/database";
import { accounts, ledgerEntries, type LedgerEntryRow } from "../infra/schema";

export type NewLedgerEntryRow = typeof ledgerEntries.$inferInsert;

export async function findEntryByIdempotencyKey(db: Database, key: string): Promise<LedgerEntryRow | null> {
  const rows = await db.select().from(ledgerEntries).where(eq(ledgerEntries.idempotencyKey, key));
  return rows[0] ?? null;
}

/**
 * Grava o lançamento e a auditoria na mesma transação (ADR-0006). Se a Idempotency-Key já existe (outra
 * requisição gravou primeiro), a chave única devolve a linha guardada e nada mais é gravado.
 */
export function insertEntryWithAudit(
  db: Database,
  row: NewLedgerEntryRow,
  auditOf: (stored: LedgerEntryRow) => AuditEntry,
): Promise<LedgerEntryRow> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .insert(ledgerEntries)
      .values(row)
      .onConflictDoUpdate({
        target: ledgerEntries.idempotencyKey,
        set: { idempotencyKey: sql`excluded.idempotency_key` },
      })
      .returning();
    const stored = rows[0];
    if (stored === undefined) throw new Error("ledger entry insert returned no row");
    if (stored.id === row.id) await recordAudit(tx, auditOf(stored));
    return stored;
  });
}

/** Situação da conta: `null` quando não existe, senão se está ativa. */
export async function findAccountActive(db: Database, id: string): Promise<boolean | null> {
  const rows = await db.select({ active: accounts.active }).from(accounts).where(eq(accounts.id, id));
  return rows[0]?.active ?? null;
}
