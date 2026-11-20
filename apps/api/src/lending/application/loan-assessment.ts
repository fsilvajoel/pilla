import {
  bps,
  cents,
  daysBetween,
  isoDate,
  lateChargesAt,
  loanStanding,
  openAmount,
  outstandingBalance,
  payoffAmount,
  type IsoDate,
  type LateTerms,
  type OpenInstallment,
} from "@pilla/finance";
import type { InstallmentStatus, LoanInstallment, LoanStanding } from "@pilla/schemas";
import type { ConfirmedAllocation } from "../../payments/public/confirmed-allocations";
import type { InstallmentRow, LoanRow } from "../infra/schema";

const NO_ALLOCATION: Omit<ConfirmedAllocation, "installmentId"> = {
  principalCents: 0,
  interestCents: 0,
  lateChargesCents: 0,
};

/** Tudo que se calcula de um contrato na data de hoje; nada disto é gravado (ADR-0005). */
export type LoanAssessment = {
  readonly installments: readonly LoanInstallment[];
  readonly totalCents: number;
  readonly interestCents: number;
  readonly paidCents: number;
  readonly outstandingCents: number;
  readonly standing: LoanStanding | null;
  readonly nextDueDate: string | null;
};

export type PayoffComponents = {
  readonly amountCents: number;
  readonly principalCents: number;
  readonly interestCents: number;
  readonly lateChargesCents: number;
};

/** Condições de atraso copiadas no contrato (ADR-0008). */
export function lateTermsOf(loan: LoanRow): LateTerms {
  return {
    finePercent: bps(BigInt(loan.lateFeeBps)),
    lateInterestMonthlyRate: bps(BigInt(loan.lateInterestMonthlyBps)),
    graceDays: loan.gracePeriodDays,
    roundingStep: cents(BigInt(loan.roundingStepCents)),
  };
}

/** Parcela com o que falta pagar: o valor da parcela menos as alocações confirmadas (principal e juros). */
function openInstallmentOf(
  row: InstallmentRow,
  allocation: Omit<ConfirmedAllocation, "installmentId">,
): OpenInstallment {
  return {
    number: row.number,
    dueDate: isoDate(row.dueDate),
    openPrincipal: cents(BigInt(row.principalCents - allocation.principalCents)),
    openInterest: cents(BigInt(row.interestCents - allocation.interestCents)),
  };
}

function openInstallments(
  rows: readonly InstallmentRow[],
  allocations: readonly ConfirmedAllocation[],
): { row: InstallmentRow; paid: number; open: OpenInstallment }[] {
  const byInstallment = new Map(allocations.map((allocation) => [allocation.installmentId, allocation]));
  return rows.map((row) => {
    const allocation = byInstallment.get(row.id) ?? NO_ALLOCATION;
    return {
      row,
      paid: allocation.principalCents + allocation.interestCents + allocation.lateChargesCents,
      open: openInstallmentOf(row, allocation),
    };
  });
}

function statusOf(open: OpenInstallment, paid: number, overdue: boolean): InstallmentStatus {
  if (openAmount(open) === 0n) return "PAID";
  if (overdue) return paid > 0 ? "OVERDUE_PARTIAL" : "OVERDUE";
  return paid > 0 ? "PARTIAL" : "OPEN";
}

/**
 * Situação do contrato em `today` (RFC-002 §3.7). Só contrato ACTIVE tem encargos, atraso e saldo devedor.
 * A parcela é OVERDUE logo após o vencimento: a carência só isenta os encargos de mora (decisão de 20/11).
 */
export function assessLoan(
  loan: LoanRow,
  installmentRows: readonly InstallmentRow[],
  allocations: readonly ConfirmedAllocation[],
  today: IsoDate,
): LoanAssessment {
  const active = loan.status === "ACTIVE";
  const terms = lateTermsOf(loan);
  const items = openInstallments(installmentRows, allocations);
  const views = items.map(({ row, paid, open }): LoanInstallment => {
    const overdue = active && daysBetween(open.dueDate, today) > 0;
    return {
      number: row.number,
      dueDate: row.dueDate,
      totalCents: row.totalCents,
      paidCents: paid,
      lateChargesCents: active ? Number(lateChargesAt(open, terms, today)) : 0,
      status: statusOf(open, paid, overdue),
    };
  });
  const opens = items.map((item) => item.open);
  return {
    installments: views,
    totalCents: installmentRows.reduce((sum, row) => sum + row.totalCents, 0),
    interestCents: installmentRows.reduce((sum, row) => sum + row.interestCents, 0),
    paidCents: items.reduce((sum, item) => sum + item.paid, 0),
    outstandingCents: active ? Number(outstandingBalance(opens, terms, today)) : 0,
    standing: active ? loanStanding(opens, { ...terms, graceDays: 0 }, today) : null,
    nextDueDate: active ? (opens.find((open) => openAmount(open) > 0n)?.dueDate ?? null) : null,
  };
}

/** Cotação de quitação sem desconto (RN-C08): principal e juros em aberto mais os encargos na data. */
export function quotePayoff(
  loan: LoanRow,
  installmentRows: readonly InstallmentRow[],
  allocations: readonly ConfirmedAllocation[],
  date: IsoDate,
): PayoffComponents {
  const terms = lateTermsOf(loan);
  const opens = openInstallments(installmentRows, allocations).map((item) => item.open);
  const sum = (pick: (open: OpenInstallment) => bigint): number =>
    Number(opens.reduce((total, open) => total + pick(open), 0n));
  return {
    amountCents: Number(payoffAmount(opens, terms, date)),
    principalCents: sum((open) => open.openPrincipal),
    interestCents: sum((open) => open.openInterest),
    lateChargesCents: sum((open) => lateChargesAt(open, terms, date)),
  };
}
