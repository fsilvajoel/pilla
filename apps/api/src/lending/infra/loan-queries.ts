import { and, asc, desc, eq, inArray, lt } from "drizzle-orm";
import type { Database } from "../../db/database";
import { installments, loans, type InstallmentRow, type LoanRow } from "./schema";

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
