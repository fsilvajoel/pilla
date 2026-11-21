import { addDays, daysBetween, lateChargesAt, openAmount, type IsoDate } from "@pilla/finance";
import type { DashboardTodayResponse, DueInstallmentItem, OverdueInstallmentItem } from "@pilla/schemas";
import type { ConfirmedAllocation } from "../../payments/public/confirmed-allocations";
import type { InstallmentRow, LoanRow } from "../infra/schema";
import { lateTermsOf, openInstallments } from "./loan-assessment";

/** Janela da semana do painel: de hoje + 1 a hoje + 7 dias, inclusive (pendência E13-F02A, padrão a). */
export const WEEK_DAYS = 7;

/** Um contrato ACTIVE com o que o painel precisa para classificar suas parcelas. */
export type DashboardLoan = {
  readonly loan: LoanRow;
  readonly personName: string;
  readonly installments: readonly InstallmentRow[];
  readonly allocations: readonly ConfirmedAllocation[];
};

type Block<T> = { count: number; totalCents: number; items: T[] };

function blockOf<T>(items: T[], amountOf: (item: T) => number): Block<T> {
  return { count: items.length, totalCents: items.reduce((sum, item) => sum + amountOf(item), 0), items };
}

const byLoanThenInstallment = (
  a: { loanNumber: string; installmentNumber: number },
  b: { loanNumber: string; installmentNumber: number },
): number => a.loanNumber.localeCompare(b.loanNumber) || a.installmentNumber - b.installmentNumber;

/**
 * Painel de parcelas em `today` (RF-50): vencendo hoje, na semana e atrasadas. Função pura sobre as parcelas em aberto de `assessLoan` e `@pilla/finance`;
 * só entram parcelas com valor em aberto (principal + juros) maior que zero. Nada é gravado (ADR-0005).
 */
export function groupDashboardInstallments(
  entries: readonly DashboardLoan[],
  today: IsoDate,
): Pick<DashboardTodayResponse, "dueToday" | "dueThisWeek" | "overdue"> {
  const weekEnd = addDays(today, WEEK_DAYS);
  const dueToday: DueInstallmentItem[] = [];
  const dueThisWeek: DueInstallmentItem[] = [];
  const overdue: OverdueInstallmentItem[] = [];
  for (const { loan, personName, installments, allocations } of entries) {
    const terms = lateTermsOf(loan);
    for (const { row, paid, open } of openInstallments(installments, allocations)) {
      const openCents = Number(openAmount(open));
      if (openCents === 0) continue;
      const base = {
        loanId: loan.id,
        loanNumber: loan.loanNumber,
        personId: loan.personId,
        personName,
        installmentNumber: row.number,
        dueDate: row.dueDate,
        openCents,
      };
      const daysLate = daysBetween(open.dueDate, today);
      if (daysLate > 0) {
        const lateChargesCents = Number(lateChargesAt(open, terms, today));
        overdue.push({
          ...base,
          daysOverdue: daysLate,
          lateChargesCents,
          totalDueCents: openCents + lateChargesCents,
          status: paid > 0 ? "OVERDUE_PARTIAL" : "OVERDUE",
        });
      } else if (daysLate === 0) {
        dueToday.push({ ...base, status: paid > 0 ? "PARTIAL" : "OPEN" });
      } else if (daysBetween(open.dueDate, weekEnd) >= 0) {
        dueThisWeek.push({ ...base, status: paid > 0 ? "PARTIAL" : "OPEN" });
      }
    }
  }
  dueToday.sort(byLoanThenInstallment);
  dueThisWeek.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || byLoanThenInstallment(a, b));
  overdue.sort((a, b) => b.daysOverdue - a.daysOverdue || byLoanThenInstallment(a, b));
  return {
    dueToday: blockOf(dueToday, (item) => item.openCents),
    dueThisWeek: blockOf(dueThisWeek, (item) => item.openCents),
    overdue: blockOf(overdue, (item) => item.totalDueCents),
  };
}
