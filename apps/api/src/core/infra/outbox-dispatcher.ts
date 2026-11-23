import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
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

/** Esboço do E12-T01; a implementação é do E12-T02. */
export function dispatchOutbox(
  _db: PgDatabase<PgQueryResultHKT>,
  _consumers: readonly OutboxConsumer[],
): Promise<DispatchResult> {
  return Promise.reject(new Error("esboço: não implementado"));
}
