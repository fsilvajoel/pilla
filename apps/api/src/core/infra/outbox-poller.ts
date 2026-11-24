import { Inject, Injectable, Logger, type OnApplicationBootstrap, type OnModuleDestroy } from "@nestjs/common";
import { DATABASE, type Database } from "../../db/database";
import { dispatchOutbox, type OutboxConsumer } from "./outbox-dispatcher";

export const OUTBOX_POLL_INTERVAL_MS = 2000;

// Token de injeção da lista de consumidores do outbox (E12 D1).
export const OUTBOX_CONSUMERS: unique symbol = Symbol("OUTBOX_CONSUMERS");

/** Agenda `dispatchOutbox` a cada 2 s, sem sobrepor rodadas (E12 D2). */
@Injectable()
export class OutboxPoller implements OnApplicationBootstrap, OnModuleDestroy {
  private timer: ReturnType<typeof setInterval> | undefined;
  private running = false;

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(OUTBOX_CONSUMERS) private readonly consumers: readonly OutboxConsumer[],
  ) {}

  onApplicationBootstrap(): void {
    this.timer = setInterval(() => void this.tick(), OUTBOX_POLL_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await dispatchOutbox(this.db, this.consumers);
    } catch (error) {
      Logger.error(`outbox run failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.running = false;
    }
  }
}
