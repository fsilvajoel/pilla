import { describe, expect, it } from "vitest";
import { isoDate } from "@pilla/finance";
import type { ConfirmedAllocation } from "../../payments/public/confirmed-allocations";
import type { InstallmentRow, LoanRow } from "../infra/schema";
import { assessLoan, quotePayoff, rolloverFigures } from "./loan-assessment";

const LOAN_ID = "01970000-0000-7000-8000-0000000000a1";
const INSTALLMENT_1 = "01970000-0000-7000-8000-0000000000b1";
const INSTALLMENT_2 = "01970000-0000-7000-8000-0000000000b2";
const STAMP = new Date("2027-01-01T12:00:00Z");

// multa 10%, mora 30% a.m. (1% ao dia), passo 1: contas exatas em centavos.
function loanRow(graceDays: number): LoanRow {
  return {
    id: LOAN_ID,
    loanNumber: "2027-0001",
    personId: "01970000-0000-7000-8000-0000000000c1",
    type: "INSTALLMENT",
    status: "ACTIVE",
    principalCents: 120000,
    monthlyInterestRateBps: 1000,
    installmentCount: 2,
    frequencyUnit: "MONTH",
    frequencyInterval: 4,
    firstDueDate: "2027-02-01",
    contractedAt: "2027-01-01",
    disbursedAt: "2027-01-01",
    accountId: "01970000-0000-7000-8000-0000000000c2",
    originLoanId: null,
    originType: null,
    capitalizedAmountCents: 0,
    lateFeeBps: 1000,
    lateInterestMonthlyBps: 3000,
    gracePeriodDays: graceDays,
    roundingStepCents: 1,
    writeOffReason: null,
    internalNotes: null,
    statusChangedAt: STAMP,
    createdAt: STAMP,
    updatedAt: STAMP,
    version: 1,
  };
}

function installmentRow(
  id: string,
  number: number,
  dueDate: string,
  principal: number,
  interest: number,
): InstallmentRow {
  return {
    id,
    loanId: LOAN_ID,
    number,
    dueDate,
    principalCents: principal,
    interestCents: interest,
    totalCents: principal + interest,
    createdAt: STAMP,
  };
}

// parcela 1 (vence 01/02): 800,00 + 200,00; parcela 2 (vence 01/06): 400,00 + 100,00.
const rows = [
  installmentRow(INSTALLMENT_1, 1, "2027-02-01", 80000, 20000),
  installmentRow(INSTALLMENT_2, 2, "2027-06-01", 40000, 10000),
];

// em 11/02 (10 dias de atraso) a parcela 1 devia 200,00 de encargos e recebeu 500,00 (200 + 200 + 100).
const partialPayment = { paidAt: "2027-02-11", lateChargesCents: 20000, interestCents: 20000, principalCents: 10000 };
const afterPartial: ConfirmedAllocation[] = [
  {
    installmentId: INSTALLMENT_1,
    principalCents: 10000,
    interestCents: 20000,
    lateChargesCents: 20000,
    payments: [partialPayment],
  },
];
const today = isoDate("2027-02-21");

describe("loan assessment with the payment history (A10 to A12)", () => {
  it("C14: the detail does not charge the fine again after a partial payment", () => {
    const detail = assessLoan(loanRow(0), rows, afterPartial, today);
    // só a mora de 10 dias sobre 700,00 (70,00); sem histórico viria multa 70,00 + mora 140,00
    expect(detail.installments.map((i) => i.lateChargesCents)).toEqual([7000, 0]);
    expect(detail.paidCents).toBe(50000);
  });

  it("C14: the balance is the open amount plus the charges, not counting the fine twice", () => {
    const detail = assessLoan(loanRow(0), rows, afterPartial, today);
    // 700,00 + 70,00 da parcela 1 e 500,00 da parcela 2
    expect(detail.outstandingCents).toBe(127000);
  });

  it("C14: charges still owed from a payment smaller than the charges show up on the installment", () => {
    // pagou só 50,00 de encargos em 11/02, sobram 150,00; em 21/02 soma mora de 100,00 sobre 1.000,00
    const smaller: ConfirmedAllocation[] = [
      {
        installmentId: INSTALLMENT_1,
        principalCents: 0,
        interestCents: 0,
        lateChargesCents: 5000,
        payments: [{ paidAt: "2027-02-11", lateChargesCents: 5000, interestCents: 0, principalCents: 0 }],
      },
    ];
    const detail = assessLoan(loanRow(0), rows, smaller, today);
    expect(detail.installments[0]?.lateChargesCents).toBe(25000);
    expect(detail.outstandingCents).toBe(100000 + 25000 + 50000);
  });

  it("C15: the payoff quote uses the history and equals the detail balance", () => {
    const quote = quotePayoff(loanRow(0), rows, afterPartial, today);
    expect(quote).toEqual({
      amountCents: 127000,
      principalCents: 110000,
      interestCents: 10000,
      lateChargesCents: 7000,
    });
    expect(quote.amountCents).toBe(assessLoan(loanRow(0), rows, afterPartial, today).outstandingCents);
  });

  it("C15: the rollover figures use the same charges", () => {
    const figures = rolloverFigures(loanRow(0), rows, afterPartial, today);
    expect(figures.lateChargesCents).toBe(7000);
    expect(figures.balanceCents).toBe(127000);
  });

  it("C16: standing is still OVERDUE when the installment has history and an open amount past due", () => {
    expect(assessLoan(loanRow(0), rows, afterPartial, today).standing).toBe("OVERDUE");
  });

  it("C16: standing is CURRENT once the overdue installment is paid, even with history", () => {
    // pagou tudo dentro da carência de 5 dias (03/02): sem encargos, parcela 1 quitada, parcela 2 ainda não venceu
    const paidInGrace: ConfirmedAllocation[] = [
      {
        installmentId: INSTALLMENT_1,
        principalCents: 80000,
        interestCents: 20000,
        lateChargesCents: 0,
        payments: [{ paidAt: "2027-02-03", lateChargesCents: 0, interestCents: 20000, principalCents: 80000 }],
      },
    ];
    const detail = assessLoan(loanRow(5), rows, paidInGrace, today);
    expect(detail.standing).toBe("CURRENT");
    expect(detail.outstandingCents).toBe(50000);
  });
});
