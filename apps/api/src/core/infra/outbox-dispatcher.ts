import { Logger } from "@nestjs/common";
import { and, asc, eq, lt, isNull, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { outbox, processedEvents } from "./schema";
import type { OutboxEvent } from "./outbox-writer";

/** Consumidor de eventos do outbox (E12 D1): recebe a transação do evento e o evento. */
export type OutboxConsumer = {
  readonly name: string;
  readonly eventTypes: readonly string[];
  handle(tx: PgDatabase<PgQueryResultHKT>, event: OutboxEvent): Promise<void>;
};

/** Contagens de uma rodada do despachante. */
export type DispatchResult = { readonly published: number; readonly failed: number };

export const OUTBOX_BATCH_SIZE = 100;
export const OUTBOX_MAX_ATTEMPTS = 5;
const LAST_ERROR_MAX_LENGTH = 500;

type Db = PgDatabase<PgQueryResultHKT>;

/** Roda um evento numa transação: consumidores interessados, `processed_events` e `published_at` (E12 D1). */
async function dispatchEvent(db: Db, consumers: readonly OutboxConsumer[], event: OutboxEvent): Promise<void> {
  await db.transaction(async (tx) => {
    for (const consumer of consumers) {
      if (!consumer.eventTypes.includes(event.type)) continue;
      const claimed = await tx
        .insert(processedEvents)
        .values({ consumer: consumer.name, eventId: event.id })
        .onConflictDoNothing()
        .returning({ eventId: processedEvents.eventId });
      if (claimed.length === 0) continue;
      await consumer.handle(tx, event);
    }
    await tx.update(outbox).set({ publishedAt: new Date() }).where(eq(outbox.id, event.id));
  });
}

/**
 * Publica os eventos pendentes do outbox (E12 D1, RFC-004 §7). Cada evento é uma transação; um erro desfaz o
 * evento inteiro, soma uma tentativa e deixa o lote seguir.
 */
export async function dispatchOutbox(db: Db, consumers: readonly OutboxConsumer[]): Promise<DispatchResult> {
  const rows = await db
    .select()
    .from(outbox)
    .where(and(isNull(outbox.publishedAt), lt(outbox.attempts, OUTBOX_MAX_ATTEMPTS)))
    .orderBy(asc(outbox.occurredAt), asc(outbox.id))
    .limit(OUTBOX_BATCH_SIZE);
  let published = 0;
  let failed = 0;
  for (const row of rows) {
    const event: OutboxEvent = {
      id: row.id,
      type: row.eventType,
      version: row.eventVersion,
      occurredAt: row.occurredAt.toISOString(),
      aggregateId: row.aggregateId,
      payload: row.payload,
    };
    try {
      await dispatchEvent(db, consumers, event);
      published += 1;
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      Logger.error(`outbox event ${event.id} (${event.type}) failed: ${message}`);
      await db
        .update(outbox)
        .set({ attempts: sql`${outbox.attempts} + 1`, lastError: message.slice(0, LAST_ERROR_MAX_LENGTH) })
        .where(eq(outbox.id, event.id));
    }
  }
  return { published, failed };
}
