import { sql } from "drizzle-orm";
import { boolean, check, date, index, integer, pgSchema, text, uniqueIndex, unique, uuid } from "drizzle-orm/pg-core";
import { cents, instant } from "../../db/columns";

// Schema `payments` (RFC-005 §5): pagamentos e a alocação de cada um nas parcelas.
export const paymentsSchema = pgSchema("payments");

// Pagamento (RFC-005 §5). Contrato, pessoa, conta e comprovante são de outros módulos: só uuid e índice (ADR-0002).
// O comprovante é obrigatório fora de CASH (RN-R06), regra validada na aplicação.
export const payments = paymentsSchema.table(
  "payments",
  {
    id: uuid("id").primaryKey(),
    loanId: uuid("loan_id").notNull(),
    // Cópia para a consulta do portal sem passar por `lending`.
    personId: uuid("person_id").notNull(),
    accountId: uuid("account_id").notNull(),
    paidAt: date("paid_at").notNull(),
    amountCents: cents("amount_cents").notNull(),
    method: text("method").notNull(),
    receiptAttachmentId: uuid("receipt_attachment_id"),
    pixEndToEndId: text("pix_end_to_end_id"),
    channel: text("channel").notNull(),
    status: text("status").notNull(),
    isRecovery: boolean("is_recovery").notNull().default(false),
    idempotencyKey: text("idempotency_key"),
    confirmedAt: instant("confirmed_at"),
    confirmedBy: uuid("confirmed_by"),
    reversedAt: instant("reversed_at"),
    reversedBy: uuid("reversed_by"),
    reversalReason: text("reversal_reason"),
    createdAt: instant("created_at").notNull().defaultNow(),
    createdBy: uuid("created_by").notNull(),
    updatedAt: instant("updated_at").notNull().defaultNow(),
    version: integer("version").notNull().default(1),
  },
  (t) => [
    index("payments_loan_id_status_idx").on(t.loanId, t.status),
    index("payments_pending_review_idx")
      .on(t.status)
      .where(sql`${t.status} = 'PENDING_REVIEW'`),
    index("payments_person_id_idx").on(t.personId),
    index("payments_account_id_idx").on(t.accountId),
    index("payments_receipt_attachment_id_idx").on(t.receiptAttachmentId),
    uniqueIndex("payments_pix_end_to_end_id_key")
      .on(t.pixEndToEndId)
      .where(sql`${t.pixEndToEndId} IS NOT NULL`),
    unique("payments_idempotency_key_key").on(t.idempotencyKey),
    check("payments_amount_cents_check", sql`${t.amountCents} > 0`),
    check("payments_method_check", sql`${t.method} IN ('PIX', 'BOLETO', 'CASH', 'BANK_TRANSFER')`),
    check("payments_channel_check", sql`${t.channel} IN ('ADMIN')`),
    check("payments_status_check", sql`${t.status} IN ('PENDING_REVIEW', 'CONFIRMED', 'REVERSED')`),
  ],
);

export type PaymentRow = typeof payments.$inferSelect;

// Alocação do pagamento numa parcela (RFC-005 §5): só acrescenta; o estorno marca reversed_at.
// Valor pago de uma parcela = soma das alocações não estornadas (calculado, ADR-0005).
export const paymentAllocations = paymentsSchema.table(
  "payment_allocations",
  {
    id: uuid("id").primaryKey(),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id),
    loanId: uuid("loan_id").notNull(),
    installmentId: uuid("installment_id").notNull(),
    lateChargesCents: cents("late_charges_cents").notNull(),
    interestCents: cents("interest_cents").notNull(),
    principalCents: cents("principal_cents").notNull(),
    reversedAt: instant("reversed_at"),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("payment_allocations_open_installment_id_idx")
      .on(t.installmentId)
      .where(sql`${t.reversedAt} IS NULL`),
    index("payment_allocations_loan_id_idx").on(t.loanId),
    index("payment_allocations_payment_id_idx").on(t.paymentId),
    check("payment_allocations_late_charges_cents_check", sql`${t.lateChargesCents} >= 0`),
    check("payment_allocations_interest_cents_check", sql`${t.interestCents} >= 0`),
    check("payment_allocations_principal_cents_check", sql`${t.principalCents} >= 0`),
  ],
);

export type PaymentAllocationRow = typeof paymentAllocations.$inferSelect;
