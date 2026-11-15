import { sql } from "drizzle-orm";
import { index, integer, jsonb, pgSchema, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

// Schema `core` (RFC-005 §2): infraestrutura compartilhada entre os módulos.
export const core = pgSchema("core");

// Instante sempre com fuso (RFC-005 §1); o modo "date" devolve Date em vez de string.
const instant = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

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
