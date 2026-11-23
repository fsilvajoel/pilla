import type { OutboxConsumer } from "../../core/infra/outbox-dispatcher";
import { treasuryLedgerConsumer } from "../application/ledger-consumer";

/** Consumidores do outbox do módulo treasury, registrados pelo `app.module.ts` (E12-F01). */
export const treasuryOutboxConsumers: readonly OutboxConsumer[] = [treasuryLedgerConsumer];
