import { sql } from "drizzle-orm";
import { boolean, check, date, index, integer, pgSchema, text, unique, uuid } from "drizzle-orm/pg-core";
import { cents, instant } from "../../db/columns";

// Schema `treasury` (RFC-005 §6): contas de capital e o livro-caixa de cada uma.
// O read model loan_positions fica fora do MVP (RFC-005 §9: começar por consulta pública de `lending`).
export const treasurySchema = pgSchema("treasury");

// Conta de capital (RFC-005 §6). A chave Pix é de `people`: só uuid e índice (ADR-0002).
export const accounts = treasurySchema.table(
  "accounts",
  {
    id: uuid("id").primaryKey(),
    name: text("name").notNull(),
    pixKeyId: uuid("pix_key_id"),
    description: text("description"),
    // Teto do capital comprometido em pontos-base; null = sem teto.
    maxCommittedBps: integer("max_committed_bps"),
    active: boolean("active").notNull().default(true),
    createdAt: instant("created_at").notNull().defaultNow(),
    updatedAt: instant("updated_at").notNull().defaultNow(),
    version: integer("version").notNull().default(1),
  },
  (t) => [
    index("accounts_pix_key_id_idx").on(t.pixKeyId),
    check("accounts_max_committed_bps_check", sql`${t.maxCommittedBps} BETWEEN 0 AND 10000`),
  ],
);

export type AccountRow = typeof accounts.$inferSelect;

// Lançamento do livro-caixa (RFC-005 §6): só acrescenta (ADR-0006); correção é outro lançamento.
// Saldo da conta = soma dos lançamentos (calculado, ADR-0005).
export const ledgerEntries = treasurySchema.table(
  "ledger_entries",
  {
    id: uuid("id").primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id),
    type: text("type").notNull(),
    // Com sinal: entrada positiva, saída negativa.
    amountCents: cents("amount_cents").notNull(),
    component: text("component"),
    sourceType: text("source_type"),
    sourceId: uuid("source_id"),
    // Evento que gerou o lançamento; com o componente, garante o consumidor idempotente.
    sourceEventId: uuid("source_event_id"),
    entryDate: date("entry_date").notNull(),
    justification: text("justification"),
    createdBy: uuid("created_by").notNull(),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("ledger_entries_account_id_entry_date_idx").on(t.accountId, t.entryDate),
    index("ledger_entries_source_type_source_id_idx").on(t.sourceType, t.sourceId),
    unique("ledger_entries_source_event_id_component_key").on(t.sourceEventId, t.component),
    check(
      "ledger_entries_type_check",
      sql`${t.type} IN ('CAPITAL_IN', 'CAPITAL_OUT', 'DISBURSEMENT', 'REPAYMENT', 'REVERSAL', 'ADJUSTMENT')`,
    ),
    check("ledger_entries_amount_cents_check", sql`${t.amountCents} <> 0`),
    check(
      "ledger_entries_component_check",
      sql`${t.component} IN ('PRINCIPAL', 'INTEREST', 'LATE_CHARGES', 'RECOVERY')`,
    ),
    check("ledger_entries_source_type_check", sql`${t.sourceType} IN ('LOAN', 'PAYMENT')`),
    check(
      "ledger_entries_justification_check",
      // Sem o IS NOT NULL, um null daria resultado null e o CHECK deixaria passar.
      sql`${t.type} <> 'ADJUSTMENT' OR (${t.justification} IS NOT NULL AND length(trim(${t.justification})) > 0)`,
    ),
  ],
);

export type LedgerEntryRow = typeof ledgerEntries.$inferSelect;
