import { describe, expect, it } from "vitest";
import { lateChargesAt, loanStanding, openAmount, outstandingBalance, payoffAmount } from "./balance";
import type { LateTerms, OpenInstallment } from "./balance";
import { isoDate } from "./date";
import { bps, cents } from "./money";

// CA-05: multa 2%, mora 1% a.m., carência 0
const terms: LateTerms = {
  finePercent: bps(200n),
  lateInterestMonthlyRate: bps(100n),
  graceDays: 0,
  roundingStep: cents(500n),
};

function open(number: number, dueDate: string, principal: bigint, interest: bigint): OpenInstallment {
  return { number, dueDate: isoDate(dueDate), openPrincipal: cents(principal), openInterest: cents(interest) };
}

// cronograma do CA-01: 6 x 1.150,00 (principal 83.333 + juros 31.667)
const ca01 = [1, 2, 3, 4, 5, 6].map((n) =>
  open(n, `2027-0${String(n + 1)}-01`, n === 6 ? 83335n : 83333n, n === 6 ? 31665n : 31667n),
);

describe("outstandingBalance", () => {
  it("RN-C08: before any due date the balance is the full schedule (future interest included)", () => {
    expect(outstandingBalance(ca01, terms, isoDate("2027-01-15"))).toBe(690000n);
  });

  it("CA-05: 1.000,00 open, 15 days late -> 1.025,00 (fine 20,00 + late interest 5,00)", () => {
    const installment = open(1, "2027-02-01", 80000n, 20000n);
    expect(lateChargesAt(installment, terms, isoDate("2027-02-16"))).toBe(2500n);
    expect(outstandingBalance([installment], terms, isoDate("2027-02-16"))).toBe(102500n);
  });

  it("RN-E02: charges are computed at ref and only for overdue installments", () => {
    // 1ª (1.150,00) vencida há 15 dias: multa 23,00 + mora 5,75 = 28,75 -> 30,00; as outras 5 não venceram
    expect(outstandingBalance(ca01, terms, isoDate("2027-02-16"))).toBe(690000n + 3000n);
  });

  it("paid installments add nothing", () => {
    const paid = open(1, "2027-02-01", 0n, 0n);
    expect(outstandingBalance([paid], terms, isoDate("2027-06-01"))).toBe(0n);
    expect(outstandingBalance([], terms, isoDate("2027-06-01"))).toBe(0n);
  });
});

describe("payoffAmount", () => {
  it("RN-C08: early payoff has no discount (equals outstanding balance)", () => {
    const ref = isoDate("2027-02-16");
    expect(payoffAmount(ca01, terms, ref)).toBe(outstandingBalance(ca01, terms, ref));
    expect(payoffAmount(ca01, terms, ref)).toBe(693000n);
  });
});

describe("loanStanding", () => {
  const graceTerms: LateTerms = { ...terms, graceDays: 3 };

  it("CURRENT when nothing is past due", () => {
    expect(loanStanding(ca01, terms, isoDate("2027-02-01"))).toBe("CURRENT");
  });

  it("OVERDUE when an open installment is past due beyond grace", () => {
    expect(loanStanding(ca01, terms, isoDate("2027-02-02"))).toBe("OVERDUE");
    expect(loanStanding(ca01, graceTerms, isoDate("2027-02-05"))).toBe("OVERDUE");
  });

  it("T-07: days equal to grace is still CURRENT", () => {
    expect(loanStanding(ca01, graceTerms, isoDate("2027-02-04"))).toBe("CURRENT");
  });

  it("a paid past-due installment does not make the loan overdue", () => {
    const paid = open(1, "2027-02-01", 0n, 0n);
    expect(loanStanding([paid, ...ca01.slice(1)], terms, isoDate("2027-02-20"))).toBe("CURRENT");
  });

  it("openAmount sums principal and interest", () => {
    expect(openAmount(open(1, "2027-02-01", 83333n, 31667n))).toBe(115000n);
  });
});
