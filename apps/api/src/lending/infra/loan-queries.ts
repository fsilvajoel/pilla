import { and, asc, desc, eq, inArray, lt } from "drizzle-orm";
import type { Database } from "../../db/database";
import { installments, loans, type InstallmentRow, type LoanRow } from "./schema";

/** Status que o cliente enxerga (E15 D8, pendência E15-T07): ACTIVE antes de PAID_OFF na ordem alfabética. */
const PORTAL_STATUSES = ["ACTIVE", "PAID_OFF"] as const;

export type LoanPageFilter = {
  readonly personId: string | null;
  readonly status: string | null;
  /** Número do último contrato já entregue: a página começa logo depois dele (ordem decrescente). */
  readonly after: string | null;
  readonly take: number;
};

/** Contratos do mais novo para o mais antigo (número do contrato), com os filtros que o banco resolve. */
export async function selectLoanPage(db: Database, filter: LoanPageFilter): Promise<LoanRow[]> {
  const conditions = [
    filter.personId === null ? undefined : eq(loans.personId, filter.personId),
    filter.status === null ? undefined : eq(loans.status, filter.status),
    filter.after === null ? undefined : lt(loans.loanNumber, filter.after),
  ];
  return db
    .select()
    .from(loans)
    .where(and(...conditions))
    .orderBy(desc(loans.loanNumber))
    .limit(filter.take);
}

export async function selectLoan(db: Database, id: string): Promise<LoanRow | null> {
  const rows = await db.select().from(loans).where(eq(loans.id, id));
  return rows[0] ?? null;
}

/** Parcelas dos contratos, por contrato, na ordem do número da parcela. */
export async function selectInstallmentsByLoan(
  db: Database,
  loanIds: readonly string[],
): Promise<Map<string, InstallmentRow[]>> {
  const byLoan = new Map<string, InstallmentRow[]>();
  if (loanIds.length === 0) return byLoan;
  const rows = await db
    .select()
    .from(installments)
    .where(inArray(installments.loanId, [...loanIds]))
    .orderBy(asc(installments.number));
  for (const row of rows) byLoan.set(row.loanId, [...(byLoan.get(row.loanId) ?? []), row]);
  return byLoan;
}

/** Contratos ACTIVE por número do contrato (sem paginação: o painel traz todos, E13 D7). */
export async function selectActiveLoans(db: Database): Promise<LoanRow[]> {
  return db.select().from(loans).where(eq(loans.status, "ACTIVE")).orderBy(asc(loans.loanNumber));
}

/** Contratos por id, em qualquer status (o painel mostra pagamentos pendentes de contratos DRAFT). */
export async function selectLoansByIds(db: Database, ids: readonly string[]): Promise<Map<string, LoanRow>> {
  if (ids.length === 0) return new Map();
  const rows = await db
    .select()
    .from(loans)
    .where(inArray(loans.id, [...ids]));
  return new Map(rows.map((row) => [row.id, row]));
}

/** Contratos do cliente que o portal mostra (ACTIVE e PAID_OFF): o filtro da pessoa vai na consulta (E15 D8, CA-09). */
export async function selectPortalLoans(db: Database, personId: string): Promise<LoanRow[]> {
  return db
    .select()
    .from(loans)
    .where(and(eq(loans.personId, personId), inArray(loans.status, [...PORTAL_STATUSES])))
    .orderBy(asc(loans.status), desc(loans.loanNumber));
}

/** Um contrato do cliente: de outra pessoa ou fora dos status do portal não existe (E15 D10). */
export async function selectPortalLoan(db: Database, personId: string, id: string): Promise<LoanRow | null> {
  const rows = await db
    .select()
    .from(loans)
    .where(and(eq(loans.id, id), eq(loans.personId, personId), inArray(loans.status, [...PORTAL_STATUSES])));
  return rows[0] ?? null;
}
