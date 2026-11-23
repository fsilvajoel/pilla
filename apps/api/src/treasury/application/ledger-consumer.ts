import { eq, and } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { loanActivatedPayload, paymentConfirmedPayload, paymentReversedPayload, type Allocation } from "@pilla/schemas";
import type { OutboxConsumer } from "../../core/infra/outbox-dispatcher";
import type { OutboxEvent } from "../../core/infra/outbox-writer";
import { SYSTEM_ACTOR_ID } from "../../core/infra/system-actor";
import { newId } from "../../core/public/ids";
import { todayInBrasilia } from "../../lending/public/brasilia-today";
import { ledgerEntries } from "../infra/schema";

type Tx = PgDatabase<PgQueryResultHKT>;
type NewEntry = typeof ledgerEntries.$inferInsert;
type Component = "PRINCIPAL" | "INTEREST" | "LATE_CHARGES" | "RECOVERY";

function entry(event: OutboxEvent, fields: Omit<NewEntry, "id" | "sourceEventId" | "createdBy">): NewEntry {
  return { id: newId(), sourceEventId: event.id, createdBy: SYSTEM_ACTOR_ID, ...fields };
}

const sum = (allocations: readonly Allocation[], pick: (a: Allocation) => number): number =>
  allocations.reduce((total, a) => total + pick(a), 0);

// RN-T02: contrato novo tira dinheiro do caixa; renovação e renegociação não (RFC-004 §7).
async function onLoanActivated(tx: Tx, event: OutboxEvent): Promise<void> {
  const p = loanActivatedPayload.parse(event.payload);
  if (p.originType === "RENEWAL" || p.originType === "RENEGOTIATION") return;
  await tx.insert(ledgerEntries).values(
    entry(event, {
      accountId: p.accountId,
      type: "DISBURSEMENT",
      component: "PRINCIPAL",
      amountCents: -p.principalCents,
      sourceType: "LOAN",
      sourceId: p.loanId,
      entryDate: p.disbursedAt,
    }),
  );
}

// RN-T03: um REPAYMENT por componente com a soma das alocações; baixado = recuperação.
async function onPaymentConfirmed(tx: Tx, event: OutboxEvent): Promise<void> {
  const p = paymentConfirmedPayload.parse(event.payload);
  const parts: readonly (readonly [Component, number])[] = p.isRecovery
    ? [["RECOVERY", p.amountCents]]
    : [
        ["LATE_CHARGES", sum(p.allocations, (a) => a.lateChargesCents)],
        ["INTEREST", sum(p.allocations, (a) => a.interestCents)],
        ["PRINCIPAL", sum(p.allocations, (a) => a.principalCents)],
      ];
  const rows = parts
    .filter(([, amount]) => amount > 0)
    .map(([component, amount]) =>
      entry(event, {
        accountId: p.accountId,
        type: "REPAYMENT",
        component,
        amountCents: amount,
        sourceType: "PAYMENT",
        sourceId: p.paymentId,
        entryDate: p.paidAt,
      }),
    );
  await tx.insert(ledgerEntries).values(rows);
}

// Estorno: espelha cada REPAYMENT do pagamento; sem REPAYMENT o evento falha e volta a ser tentado.
async function onPaymentReversed(tx: Tx, event: OutboxEvent): Promise<void> {
  const p = paymentReversedPayload.parse(event.payload);
  const repayments = await tx
    .select()
    .from(ledgerEntries)
    .where(
      and(
        eq(ledgerEntries.type, "REPAYMENT"),
        eq(ledgerEntries.sourceType, "PAYMENT"),
        eq(ledgerEntries.sourceId, p.paymentId),
      ),
    );
  if (repayments.length === 0) throw new Error(`no REPAYMENT entries for payment ${p.paymentId}`);
  const today = todayInBrasilia(new Date());
  await tx.insert(ledgerEntries).values(
    repayments.map((r) =>
      entry(event, {
        accountId: r.accountId,
        type: "REVERSAL",
        component: r.component,
        amountCents: -r.amountCents,
        sourceType: "PAYMENT",
        sourceId: p.paymentId,
        entryDate: today,
      }),
    ),
  );
}

const handlers: Record<string, (tx: Tx, event: OutboxEvent) => Promise<void>> = {
  LoanActivated: onLoanActivated,
  PaymentConfirmed: onPaymentConfirmed,
  PaymentReversed: onPaymentReversed,
};

/** Consumidor `treasury-ledger` (E12 D3): lança no livro-caixa o que os eventos de contrato e pagamento movem. */
export const treasuryLedgerConsumer: OutboxConsumer = {
  name: "treasury-ledger",
  eventTypes: Object.keys(handlers),
  handle: async (tx, event) => {
    await handlers[event.type]?.(tx, event);
  },
};
