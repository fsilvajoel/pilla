import { sql } from "drizzle-orm";
import {
  bigint,
  char,
  check,
  index,
  inet,
  integer,
  jsonb,
  pgSchema,
  primaryKey,
  text,
  uuid,
} from "drizzle-orm/pg-core";
import { instant } from "../../db/columns";

// Schema `core` (RFC-005 §2): infraestrutura compartilhada entre os módulos.
export const core = pgSchema("core");

// Outbox transacional: o evento é gravado na mesma transação da mudança e publicado depois pelo worker.
export const outbox = core.table(
  "outbox",
  {
    id: uuid("id").primaryKey(),
    eventType: text("event_type").notNull(),
    eventVersion: integer("event_version").notNull(),
    aggregateId: uuid("aggregate_id").notNull(),
    payload: jsonb("payload").notNull(),
    occurredAt: instant("occurred_at").notNull(),
    publishedAt: instant("published_at"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
  },
  // Índice parcial: o worker só varre os pendentes (published_at nulo), em ordem de ocorrência.
  (t) => [
    index("outbox_pending_idx")
      .on(t.occurredAt)
      .where(sql`${t.publishedAt} IS NULL`),
  ],
);

// Idempotência por consumidor: o mesmo evento nunca é processado duas vezes pelo mesmo consumidor.
export const processedEvents = core.table(
  "processed_events",
  {
    consumer: text("consumer").notNull(),
    eventId: uuid("event_id").notNull(),
    processedAt: instant("processed_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.consumer, t.eventId] })],
);

// Tabela de auditoria: registro de todas as alterações de entidades (RFC-005 §2).
export const auditLog = core.table(
  "audit_log",
  {
    id: uuid("id").primaryKey(),
    actorType: text("actor_type").notNull(),
    actorId: uuid("actor_id"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    before: jsonb("before"),
    after: jsonb("after"),
    at: instant("at").notNull(),
    ip: inet("ip"),
  },
  (t) => [
    index("audit_log_history_idx").on(t.entityType, t.entityId, t.at),
    check("audit_log_actor_type_check", sql`${t.actorType} IN ('ADMIN', 'CLIENT', 'SYSTEM')`),
  ],
);

export type AuditLogRow = typeof auditLog.$inferSelect;

// Anexos (RFC-005 §2): metadados dos arquivos enviados; o conteúdo fica no armazenamento.
export const attachments = core.table(
  "attachments",
  {
    id: uuid("id").primaryKey(),
    kind: text("kind").notNull(),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    sha256: char("sha256", { length: 64 }).notNull(),
    storageKey: text("storage_key").notNull().unique(),
    uploadedBy: uuid("uploaded_by").notNull(),
    uploadedAt: instant("uploaded_at").notNull(),
  },
  (t) => [
    check("attachments_kind_check", sql`${t.kind} IN ('RECEIPT', 'SIGNED_CONTRACT', 'IMPORT_FILE', 'OTHER')`),
    check("attachments_size_bytes_check", sql`${t.sizeBytes} >= 0`),
    check("attachments_sha256_check", sql`${t.sha256} ~ '^[0-9a-f]{64}$'`),
  ],
);

export type AttachmentRow = typeof attachments.$inferSelect;
