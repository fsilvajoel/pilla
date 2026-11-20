import { and, count, eq, inArray, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { writeOutboxEvent, type OutboxEvent } from "../../core/infra/outbox-writer";
import { recordAudit, type AuditEntry } from "../../core/public/audit";
import { installments, loanNumberSequences, loans, type LoanRow } from "./schema";

export type NewLoanRow = typeof loans.$inferInsert;
export type NewInstallmentRow = typeof installments.$inferInsert;
export type LoanDraftChanges = Partial<
  Pick<
    NewLoanRow,
    | "type"
    | "principalCents"
    | "monthlyInterestRateBps"
    | "installmentCount"
    | "frequencyUnit"
    | "frequencyInterval"
    | "firstDueDate"
    | "lateFeeBps"
    | "lateInterestMonthlyBps"
    | "gracePeriodDays"
    | "internalNotes"
  >
>;

/** Operações de contrato dentro de uma transação; as regras (DRAFT, versão) ficam na aplicação. */
export type LoanStore = {
  /** Próximo número do ano (`AAAA-NNNN`), tirado de loan_number_sequences na mesma transação. */
  nextLoanNumber(year: number): Promise<string>;
  insert(row: NewLoanRow): Promise<LoanRow>;
  /** Lê o contrato travando a linha até o fim da transação. */
  findForUpdate(id: string): Promise<LoanRow | null>;
  /** Grava as mudanças, soma 1 em version e atualiza updated_at. */
  updateDraft(id: string, changes: LoanDraftChanges): Promise<LoanRow>;
  /** Marca CANCELLED com status_changed_at, soma 1 em version. */
  cancel(id: string): Promise<LoanRow>;
  /** Passa o DRAFT para ACTIVE com desembolso e conta, soma 1 em version e grava status_changed_at. */
  activate(id: string, disbursedAt: string, accountId: string): Promise<LoanRow>;
  /** Passa a origem de ACTIVE para o status final (RENEWED ou RENEGOTIATED), soma 1 em version. */
  settleOrigin(id: string, status: "RENEWED" | "RENEGOTIATED"): Promise<LoanRow>;
  insertInstallments(rows: NewInstallmentRow[]): Promise<void>;
  /** Grava o evento no core.outbox na mesma transação (D7). */
  outbox(event: OutboxEvent): Promise<void>;
  /** Quantos contratos ACTIVE a pessoa tem (RN-C11; a situação em atraso vem na F05). */
  countActiveByPerson(personId: string): Promise<number>;
  /** Grava a auditoria na mesma transação (ADR-0006). */
  audit(entry: AuditEntry): Promise<void>;
};

export type LoanRepository = { inTransaction<T>(work: (store: LoanStore) => Promise<T>): Promise<T> };

function firstRow(rows: LoanRow[], what: string): LoanRow {
  const row = rows[0];
  if (row === undefined) throw new Error(`${what} returned no row`);
  return row;
}

function storeOf(tx: PgDatabase<PgQueryResultHKT>): LoanStore {
  return {
    async nextLoanNumber(year) {
      const rows = await tx
        .insert(loanNumberSequences)
        .values({ year, lastValue: 1 })
        .onConflictDoUpdate({
          target: loanNumberSequences.year,
          set: { lastValue: sql`${loanNumberSequences.lastValue} + 1` },
        })
        .returning({ lastValue: loanNumberSequences.lastValue });
      const last = rows[0]?.lastValue;
      if (last === undefined) throw new Error("loan number sequence returned no row");
      return `${String(year)}-${String(last).padStart(4, "0")}`;
    },
    async insert(row) {
      return firstRow(await tx.insert(loans).values(row).returning(), "loan insert");
    },
    async findForUpdate(id) {
      const rows = await tx.select().from(loans).where(eq(loans.id, id)).for("update");
      return rows[0] ?? null;
    },
    async updateDraft(id, changes) {
      const rows = await tx
        .update(loans)
        .set({ ...changes, version: sql`${loans.version} + 1`, updatedAt: sql`now()` })
        .where(eq(loans.id, id))
        .returning();
      return firstRow(rows, "loan update");
    },
    async cancel(id) {
      const rows = await tx
        .update(loans)
        .set({
          status: "CANCELLED",
          statusChangedAt: sql`now()`,
          version: sql`${loans.version} + 1`,
          updatedAt: sql`now()`,
        })
        .where(eq(loans.id, id))
        .returning();
      return firstRow(rows, "loan cancel");
    },
    async activate(id, disbursedAt, accountId) {
      const rows = await tx
        .update(loans)
        .set({
          status: "ACTIVE",
          disbursedAt,
          accountId,
          statusChangedAt: sql`now()`,
          version: sql`${loans.version} + 1`,
          updatedAt: sql`now()`,
        })
        .where(eq(loans.id, id))
        .returning();
      return firstRow(rows, "loan activate");
    },
    async settleOrigin(id, status) {
      const rows = await tx
        .update(loans)
        .set({ status, statusChangedAt: sql`now()`, version: sql`${loans.version} + 1`, updatedAt: sql`now()` })
        .where(eq(loans.id, id))
        .returning();
      return firstRow(rows, "origin settle");
    },
    async insertInstallments(rows) {
      await tx.insert(installments).values(rows);
    },
    outbox: (event) => writeOutboxEvent(tx, event),
    async countActiveByPerson(personId) {
      const rows = await tx
        .select({ total: count() })
        .from(loans)
        .where(and(eq(loans.personId, personId), inArray(loans.status, ["ACTIVE"])));
      return rows.reduce((sum, row) => sum + row.total, 0);
    },
    audit: (entry) => recordAudit(tx, entry),
  };
}

export function loanRepository(db: PgDatabase<PgQueryResultHKT>): LoanRepository {
  return { inTransaction: (work) => db.transaction((tx) => work(storeOf(tx))) };
}
