import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { allocatePayment, cents, daysBetween, isoDate, outstandingBalance, type OpenInstallment } from "@pilla/finance";
import {
  allocationPreviewResponse,
  type AllocationPreviewRequest,
  type AllocationPreviewResponse,
} from "@pilla/schemas";
import { ProblemException } from "../../core/http/problem-exception";
import { isClosedForPayments } from "../../lending/domain/loan-status";
import { loadLoanForPayment, type PaymentLoan } from "../../lending/public/loan-for-payment";
import { confirmedAllocationsByLoan } from "../public/confirmed-allocations";

const NO_ALLOCATION = { principalCents: 0, interestCents: 0 };

/** Parcelas em aberto: o valor de cada parcela do contrato menos as alocações confirmadas (E11 D5). */
async function openInstallmentsOf(db: PgDatabase<PgQueryResultHKT>, loan: PaymentLoan): Promise<OpenInstallment[]> {
  const confirmed = new Map((await confirmedAllocationsByLoan(db, loan.id)).map((item) => [item.installmentId, item]));
  return loan.installments.map((installment) => {
    const paid = confirmed.get(installment.id) ?? NO_ALLOCATION;
    return {
      number: installment.number,
      dueDate: isoDate(installment.dueDate),
      openPrincipal: cents(BigInt(installment.principalCents - paid.principalCents)),
      openInterest: cents(BigInt(installment.interestCents - paid.interestCents)),
    };
  });
}

function paidAtError(message: string): ProblemException {
  return new ProblemException("VALIDATION_FAILED", "Dados inválidos.", [{ field: "paidAt", message }]);
}

/**
 * Prévia da alocação (RF-23, E11 D5 a D7): distribui o pagamento pelas parcelas em aberto com `allocatePayment`
 * na data do pagamento, sem gravar nada. A F02 e a F03 reaproveitam este caso de uso.
 */
export async function previewAllocation(
  db: PgDatabase<PgQueryResultHKT>,
  request: AllocationPreviewRequest,
  today: string,
): Promise<AllocationPreviewResponse> {
  const loan = await loadLoanForPayment(db, request.loanId);
  if (loan === null) throw new ProblemException("NOT_FOUND", "Recurso não encontrado.");
  return previewForLoan(db, loan, request, today);
}

/** Mesma prévia para um contrato já lido (a confirmação o lê travado, dentro da transação). */
export async function previewForLoan(
  db: PgDatabase<PgQueryResultHKT>,
  loan: PaymentLoan,
  request: AllocationPreviewRequest,
  today: string,
): Promise<AllocationPreviewResponse> {
  if (isClosedForPayments(loan.status)) {
    throw new ProblemException(
      "LOAN_CLOSED_FOR_PAYMENTS",
      "O contrato não aceita pagamentos.",
      undefined,
      loan.successorLoanId ?? undefined,
    );
  }
  const base = {
    loanId: loan.id,
    loanStatus: loan.status,
    paidAt: request.paidAt,
    amountCents: request.amountCents,
    isRecovery: loan.status === "WRITTEN_OFF",
  };
  // DRAFT não tem cronograma: só o formato foi validado; a distribuição existe na confirmação (D7).
  if (loan.status === "DRAFT") {
    return allocationPreviewResponse.parse({
      ...base,
      deferred: true,
      allocations: [],
      totals: { lateChargesCents: 0, interestCents: 0, principalCents: 0 },
      outstandingBeforeCents: null,
      outstandingAfterCents: null,
      paysOff: false,
    });
  }
  const paidAt = isoDate(request.paidAt);
  // ACTIVE e WRITTEN_OFF sempre têm desembolso (CHECK loans_disbursed_at_check).
  if (loan.disbursedAt !== null && daysBetween(isoDate(loan.disbursedAt), paidAt) < 0) {
    throw paidAtError("A data não pode ser anterior ao desembolso.");
  }
  if (daysBetween(isoDate(today), paidAt) > 0) throw paidAtError("A data não pode ser futura.");
  const opens = await openInstallmentsOf(db, loan);
  const before = outstandingBalance(opens, loan.lateTerms, paidAt);
  const amount = cents(BigInt(request.amountCents));
  if (amount > before) {
    throw new ProblemException("PAYMENT_EXCEEDS_BALANCE", "O valor é maior que o saldo devedor.");
  }
  const dueDates = new Map(opens.map((open) => [open.number, open.dueDate]));
  const allocations = allocatePayment(amount, opens, loan.lateTerms, paidAt).map((allocation) => ({
    installmentNumber: allocation.installmentNumber,
    dueDate: dueDates.get(allocation.installmentNumber),
    lateChargesCents: Number(allocation.lateCharges),
    interestCents: Number(allocation.interest),
    principalCents: Number(allocation.principal),
    installmentStatusAfter: allocation.status,
  }));
  const total = (pick: (item: (typeof allocations)[number]) => number): number =>
    allocations.reduce((sum, item) => sum + pick(item), 0);
  const after = Number(before - amount);
  return allocationPreviewResponse.parse({
    ...base,
    deferred: false,
    allocations,
    totals: {
      lateChargesCents: total((item) => item.lateChargesCents),
      interestCents: total((item) => item.interestCents),
      principalCents: total((item) => item.principalCents),
    },
    outstandingBeforeCents: Number(before),
    outstandingAfterCents: after,
    paysOff: loan.status === "ACTIVE" && after === 0,
  });
}
