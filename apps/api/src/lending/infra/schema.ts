import { sql } from "drizzle-orm";
import { check, date, foreignKey, index, integer, pgSchema, text, unique, uuid } from "drizzle-orm/pg-core";
import { cents, instant } from "../../db/columns";

// Schema `lending` (RFC-005 §4): condições padrão, contratos, parcelas e numeração anual dos contratos.
export const lending = pgSchema("lending");

// Condições padrão com histórico (RFC-005 §4): a vigente é a de maior effective_from; linha nunca é editada.
export const defaultTerms = lending.table(
  "default_terms",
  {
    id: uuid("id").primaryKey(),
    lateFeeBps: integer("late_fee_bps").notNull(),
    lateInterestMonthlyBps: integer("late_interest_monthly_bps").notNull(),
    gracePeriodDays: integer("grace_period_days").notNull(),
    suggestedMonthlyRateBps: integer("suggested_monthly_rate_bps").notNull(),
    roundingStepCents: cents("rounding_step_cents").notNull().default(500),
    effectiveFrom: instant("effective_from").notNull(),
    createdBy: uuid("created_by").notNull(),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("default_terms_effective_from_idx").on(t.effectiveFrom),
    check("default_terms_late_fee_bps_check", sql`${t.lateFeeBps} >= 0`),
    check("default_terms_late_interest_monthly_bps_check", sql`${t.lateInterestMonthlyBps} >= 0`),
    check("default_terms_grace_period_days_check", sql`${t.gracePeriodDays} >= 0`),
    check("default_terms_suggested_monthly_rate_bps_check", sql`${t.suggestedMonthlyRateBps} >= 0`),
    check("default_terms_rounding_step_cents_check", sql`${t.roundingStepCents} > 0`),
  ],
);

export type DefaultTermsRow = typeof defaultTerms.$inferSelect;

// Contrato (RFC-005 §4). Pessoa e conta são de outros módulos: só uuid e índice, sem FK (ADR-0002).
// As condições de atraso e o passo de arredondamento são cópia das padrão na contratação (ADR-0008).
export const loans = lending.table(
  "loans",
  {
    id: uuid("id").primaryKey(),
    loanNumber: text("loan_number").notNull(),
    personId: uuid("person_id").notNull(),
    type: text("type").notNull(),
    status: text("status").notNull(),
    principalCents: cents("principal_cents").notNull(),
    monthlyInterestRateBps: integer("monthly_interest_rate_bps").notNull(),
    installmentCount: integer("installment_count"),
    frequencyUnit: text("frequency_unit").notNull(),
    frequencyInterval: integer("frequency_interval").notNull(),
    firstDueDate: date("first_due_date").notNull(),
    contractedAt: date("contracted_at").notNull(),
    disbursedAt: date("disbursed_at"),
    accountId: uuid("account_id").notNull(),
    originLoanId: uuid("origin_loan_id"),
    originType: text("origin_type"),
    capitalizedAmountCents: cents("capitalized_amount_cents").notNull().default(0),
    lateFeeBps: integer("late_fee_bps").notNull(),
    lateInterestMonthlyBps: integer("late_interest_monthly_bps").notNull(),
    gracePeriodDays: integer("grace_period_days").notNull(),
    roundingStepCents: cents("rounding_step_cents").notNull(),
    writeOffReason: text("write_off_reason"),
    // Nunca exposto no portal do cliente (RFC-005 §4).
    internalNotes: text("internal_notes"),
    statusChangedAt: instant("status_changed_at").notNull().defaultNow(),
    createdAt: instant("created_at").notNull().defaultNow(),
    updatedAt: instant("updated_at").notNull().defaultNow(),
    version: integer("version").notNull().default(1),
  },
  (t) => [
    unique("loans_loan_number_key").on(t.loanNumber),
    index("loans_person_id_status_idx").on(t.personId, t.status),
    index("loans_status_idx").on(t.status),
    index("loans_origin_loan_id_idx").on(t.originLoanId),
    index("loans_account_id_idx").on(t.accountId),
    foreignKey({ name: "loans_origin_loan_id_fkey", columns: [t.originLoanId], foreignColumns: [t.id] }),
    check("loans_loan_number_check", sql`${t.loanNumber} ~ '^[0-9]{4}-[0-9]{4,}$'`),
    check("loans_type_check", sql`${t.type} IN ('INSTALLMENT', 'SINGLE_PAYMENT', 'INTEREST_ONLY', 'CUSTOM')`),
    check(
      "loans_status_check",
      sql`${t.status} IN ('DRAFT', 'ACTIVE', 'PAID_OFF', 'RENEWED', 'RENEGOTIATED', 'WRITTEN_OFF', 'CANCELLED')`,
    ),
    check("loans_principal_cents_check", sql`${t.principalCents} > 0`),
    check("loans_monthly_interest_rate_bps_check", sql`${t.monthlyInterestRateBps} >= 0`),
    // Sem o IS NOT NULL, "NULL >= 1" vira NULL e o CHECK aceitaria contrato parcelado sem parcelas.
    check(
      "loans_installment_count_check",
      sql`(${t.installmentCount} IS NOT NULL AND ${t.installmentCount} >= 1) OR (${t.installmentCount} IS NULL AND ${t.type} = 'INTEREST_ONLY')`,
    ),
    check("loans_frequency_unit_check", sql`${t.frequencyUnit} IN ('DAY', 'MONTH')`),
    check("loans_frequency_interval_check", sql`${t.frequencyInterval} >= 1`),
    check("loans_disbursed_at_check", sql`${t.status} IN ('DRAFT', 'CANCELLED') OR ${t.disbursedAt} IS NOT NULL`),
    check("loans_origin_type_check", sql`${t.originType} IN ('RENEWAL', 'RENEGOTIATION', 'IMPORT')`),
    check("loans_capitalized_amount_cents_check", sql`${t.capitalizedAmountCents} >= 0`),
    check("loans_late_fee_bps_check", sql`${t.lateFeeBps} >= 0`),
    check("loans_late_interest_monthly_bps_check", sql`${t.lateInterestMonthlyBps} >= 0`),
    check("loans_grace_period_days_check", sql`${t.gracePeriodDays} >= 0`),
    check("loans_rounding_step_cents_check", sql`${t.roundingStepCents} > 0`),
  ],
);

export type LoanRow = typeof loans.$inferSelect;

// Parcela (RFC-005 §4): gerada na ativação e nunca editada; em INTEREST_ONLY a seguinte entra quando a anterior
// vence ou é paga (RFC-002 §3.4).
export const installments = lending.table(
  "installments",
  {
    id: uuid("id").primaryKey(),
    loanId: uuid("loan_id")
      .notNull()
      .references(() => loans.id),
    number: integer("number").notNull(),
    dueDate: date("due_date").notNull(),
    principalCents: cents("principal_cents").notNull(),
    interestCents: cents("interest_cents").notNull(),
    totalCents: cents("total_cents").notNull(),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    unique("installments_loan_id_number_key").on(t.loanId, t.number),
    index("installments_due_date_idx").on(t.dueDate),
    check("installments_number_check", sql`${t.number} >= 1`),
    check("installments_principal_cents_check", sql`${t.principalCents} >= 0`),
    check("installments_interest_cents_check", sql`${t.interestCents} >= 0`),
    check("installments_total_cents_check", sql`${t.totalCents} = ${t.principalCents} + ${t.interestCents}`),
  ],
);

export type InstallmentRow = typeof installments.$inferSelect;

// Último número de contrato usado em cada ano (loan_number `AAAA-NNNN`, RFC-005 §4).
export const loanNumberSequences = lending.table(
  "loan_number_sequences",
  {
    year: integer("year").primaryKey(),
    lastValue: integer("last_value").notNull().default(0),
  },
  (t) => [check("loan_number_sequences_last_value_check", sql`${t.lastValue} >= 0`)],
);

export type LoanNumberSequenceRow = typeof loanNumberSequences.$inferSelect;
