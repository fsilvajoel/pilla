import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { auditLog } from "../infra/schema";

/** Quem fez a alteração (RFC-005 §2, `core.audit_log.actor_type`). */
export type ActorType = "ADMIN" | "CLIENT" | "SYSTEM";

/** Uma linha de `core.audit_log` (ADR-0006: quem, quando, antes e depois); os campos têm o nome das colunas. */
export type AuditEntry = {
  id: string;
  actorType: ActorType;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before: unknown;
  after: unknown;
  at: Date;
  ip: string | null;
};

/** Grava a entrada como veio em `core.audit_log`; um erro do banco sobe sem tratamento. */
export async function recordAudit(db: PgDatabase<PgQueryResultHKT>, entry: AuditEntry): Promise<void> {
  await db.insert(auditLog).values(entry);
}
