import type { OutboxConsumer } from "../../core/infra/outbox-dispatcher";

/** Esboço do E12-T01; a implementação (regras do E12 D3) é do E12-T02. */
export const treasuryLedgerConsumer: OutboxConsumer = {
  name: "treasury-ledger",
  eventTypes: ["LoanActivated", "PaymentConfirmed", "PaymentReversed"],
  handle: () => Promise.reject(new Error("esboço: não implementado")),
};
