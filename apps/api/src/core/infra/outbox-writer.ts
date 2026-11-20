import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { outbox } from "./schema";

/** Evento já validado pelo Zod de `@pilla/schemas` (envelope v1, RFC-004 §7). */
export type OutboxEvent = {
  id: string;
  type: string;
  version: number;
  occurredAt: string;
  aggregateId: string;
  payload: unknown;
};

/** Grava o evento em `core.outbox` na transação de quem chama (D7); o worker publica depois. */
export async function writeOutboxEvent(db: PgDatabase<PgQueryResultHKT>, event: OutboxEvent): Promise<void> {
  await db.insert(outbox).values({
    id: event.id,
    eventType: event.type,
    eventVersion: event.version,
    aggregateId: event.aggregateId,
    payload: event.payload,
    occurredAt: new Date(event.occurredAt),
  });
}
