import { Inject, Injectable, type OnApplicationBootstrap, type OnModuleDestroy } from "@nestjs/common";
import { DATABASE, type Database } from "../../db/database";
import type { OutboxConsumer } from "./outbox-dispatcher";

export const OUTBOX_POLL_INTERVAL_MS = 2000;

// Token de injeção da lista de consumidores do outbox (E12 D1).
export const OUTBOX_CONSUMERS: unique symbol = Symbol("OUTBOX_CONSUMERS");

/** Esboço do E12-T01; a implementação é do E12-T02. */
@Injectable()
export class OutboxPoller implements OnApplicationBootstrap, OnModuleDestroy {
  constructor(@Inject(DATABASE) _db: Database, @Inject(OUTBOX_CONSUMERS) _consumers: readonly OutboxConsumer[]) {}

  onApplicationBootstrap(): void {
    throw new Error("esboço: não implementado");
  }

  onModuleDestroy(): void {
    throw new Error("esboço: não implementado");
  }
}
