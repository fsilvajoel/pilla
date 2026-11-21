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
  payments: [],
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

/** Parcela mínima para montar o em aberto (a linha do banco e a do módulo de pagamentos servem). */
export type InstallmentValues = {
  readonly number: number;
  readonly dueDate: string;
  readonly principalCents: number;
  readonly interestCents: number;
};

/** Parcela com o que falta pagar: o valor da parcela menos as alocações confirmadas, com o histórico de pagamentos. */
function openInstallmentOf(
  row: InstallmentValues,
  allocation: Omit<ConfirmedAllocation, "installmentId">,
): OpenInstallment {
  return {
    number: row.number,
    dueDate: isoDate(row.dueDate),
    openPrincipal: cents(BigInt(row.principalCents - allocation.principalCents)),
    openInterest: cents(BigInt(row.interestCents - allocation.interestCents)),
    payments: allocation.payments.map((payment) => ({
      paidAt: isoDate(payment.paidAt),
      lateCharges: cents(BigInt(payment.lateChargesCents)),
      interest: cents(BigInt(payment.interestCents)),
      principal: cents(BigInt(payment.principalCents)),
    })),
  };
}

/** Único ponto que monta as parcelas em aberto (com histórico): detalhe, cotação, prévia e confirmação o usam. */
export function openInstallmentsWithHistory(
  installments: readonly (InstallmentValues & { readonly id: string })[],
  allocations: readonly ConfirmedAllocation[],
): OpenInstallment[] {
  const byInstallment = new Map(allocations.map((allocation) => [allocation.installmentId, allocation]));
  return installments.map((row) => openInstallmentOf(row, byInstallment.get(row.id) ?? NO_ALLOCATION));
}

/** Cada parcela com o pago e o que falta pagar (principal e juros), na ordem recebida. */
export function openInstallments(
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

/** Números de renovação e renegociação na data (RN-C14, RN-C15, RN-C17), todos vindos das parcelas em aberto. */
export type RolloverFigures = {
  readonly openPrincipalCents: number;
  readonly overdueInterestCents: number;
  readonly lateChargesCents: number;
  readonly balanceCents: number;
};

/** Principal em aberto, juros vencidos em aberto, encargos e saldo devedor em `date` (reusa as contas da F05). */
export function rolloverFigures(
  loan: LoanRow,
  installmentRows: readonly InstallmentRow[],
  allocations: readonly ConfirmedAllocation[],
  date: IsoDate,
): RolloverFigures {
  const terms = lateTermsOf(loan);
  const opens = openInstallments(installmentRows, allocations).map((item) => item.open);
  const sum = (pick: (open: OpenInstallment) => bigint): number =>
    Number(opens.reduce((total, open) => total + pick(open), 0n));
  return {
    openPrincipalCents: sum((open) => open.openPrincipal),
    overdueInterestCents: sum((open) => (daysBetween(open.dueDate, date) > 0 ? open.openInterest : 0n)),
    lateChargesCents: sum((open) => lateChargesAt(open, terms, date)),
    balanceCents: Number(outstandingBalance(opens, terms, date)),
  };
}
