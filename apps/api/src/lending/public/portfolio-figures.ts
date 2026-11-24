import { eq } from "drizzle-orm";
import type { Database } from "../../db/database";
import { confirmedAllocationsByLoans, type ConfirmedAllocation } from "../../payments/public/confirmed-allocations";
import { openInstallments } from "../application/loan-assessment";
import { selectActiveLoans, selectInstallmentsByLoan } from "../infra/loan-queries";
import { loans, type InstallmentRow, type LoanRow } from "../infra/schema";

/** Mês do painel da tesouraria: primeiro e último dia (YYYY-MM-DD), inclusivos (E12 D7). */
export type PortfolioMonth = { readonly monthStart: string; readonly monthEnd: string };

/** Números da carteira para o painel da tesouraria (E12 D7, D8); nada é gravado (ADR-0005). */
export type PortfolioFigures = {
  readonly activeOutstandingPrincipalCents: number;
  readonly writtenOffOutstandingPrincipalCents: number;
  readonly forecastCents: number;
};

type LoanFigures = { readonly outstandingPrincipalCents: number; readonly forecastCents: number };

/** Principal em aberto do contrato e, do mês, principal mais juros em aberto (sem encargos). */
function loanFigures(
  loan: LoanRow,
  installmentsByLoan: Map<string, InstallmentRow[]>,
  allocationsByLoan: Map<string, ConfirmedAllocation[]>,
  month: PortfolioMonth,
): LoanFigures {
  const allocations = allocationsByLoan.get(loan.id) ?? [];
  const items = openInstallments(installmentsByLoan.get(loan.id) ?? [], allocations);
  let outstandingPrincipalCents = 0;
  let forecastCents = 0;
  for (const { row, open } of items) {
    const principal = Number(open.openPrincipal);
    outstandingPrincipalCents += principal;
    if (row.dueDate >= month.monthStart && row.dueDate <= month.monthEnd) {
      forecastCents += principal + Number(open.openInterest);
    }
  }
  return { outstandingPrincipalCents, forecastCents };
}

async function figuresOf(db: Database, rows: readonly LoanRow[], month: PortfolioMonth): Promise<LoanFigures[]> {
  const ids = rows.map((row) => row.id);
  const byLoan = await selectInstallmentsByLoan(db, ids);
  const allocations = await confirmedAllocationsByLoans(db, ids);
  return rows.map((row) => loanFigures(row, byLoan, allocations, month));
}

const sumOf = (figures: readonly LoanFigures[], pick: (figure: LoanFigures) => number): number =>
  figures.reduce((total, figure) => total + pick(figure), 0);

/**
 * Principal em aberto dos contratos ACTIVE e WRITTEN_OFF e a previsão do mês dos ACTIVE (E12 D7). Monta as parcelas
 * em aberto com `openInstallments` de loan-assessment, a mesma base de detalhe, cotação e confirmação.
 */
export async function portfolioFigures(db: Database, month: PortfolioMonth): Promise<PortfolioFigures> {
  const active = await figuresOf(db, await selectActiveLoans(db), month);
  const writtenOffRows = await db.select().from(loans).where(eq(loans.status, "WRITTEN_OFF"));
  const writtenOff = await figuresOf(db, writtenOffRows, month);
  return {
    activeOutstandingPrincipalCents: sumOf(active, (figure) => figure.outstandingPrincipalCents),
    writtenOffOutstandingPrincipalCents: sumOf(writtenOff, (figure) => figure.outstandingPrincipalCents),
    forecastCents: sumOf(active, (figure) => figure.forecastCents),
  };
}
