import { describe, expect, it } from "vitest";
import { allocatePayment, AllocationError } from "./allocation";
import type { LateTerms, OpenInstallment } from "./balance";
import { isoDate } from "./date";
import { bps, cents } from "./money";

const terms: LateTerms = {
  finePercent: bps(200n),
  lateInterestMonthlyRate: bps(100n),
  graceDays: 0,
  roundingStep: cents(500n),
};

function open(number: number, dueDate: string, principal: bigint, interest: bigint): OpenInstallment {
  return { number, dueDate: isoDate(dueDate), openPrincipal: cents(principal), openInterest: cents(interest) };
}

function errorCode(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (error) {
    if (error instanceof AllocationError) return error.code;
  }
  return undefined;
}

describe("allocatePayment", () => {
  it("T-05: 1.500,00 on [1.150,00 due today, 1.150,00 future] -> 1st PAID, 350,00 on the 2nd (PARTIAL)", () => {
    const installments = [open(1, "2027-02-01", 83333n, 31667n), open(2, "2027-03-01", 83333n, 31667n)];
    expect(allocatePayment(cents(150000n), installments, terms, isoDate("2027-02-01"))).toEqual([
      { installmentNumber: 1, lateCharges: 0n, interest: 31667n, principal: 83333n, status: "PAID" },
      { installmentNumber: 2, lateCharges: 0n, interest: 31667n, principal: 3333n, status: "PARTIAL" },
    ]);
  });

  it("CA-06: 1.025,00 on the CA-05 installment -> charges 25,00, then interest, then principal; PAID", () => {
    const installments = [open(1, "2027-02-01", 80000n, 20000n)];
    expect(allocatePayment(cents(102500n), installments, terms, isoDate("2027-02-16"))).toEqual([
      { installmentNumber: 1, lateCharges: 2500n, interest: 20000n, principal: 80000n, status: "PAID" },
    ]);
  });

  it("RN-R02: inside an installment the order is charges -> interest -> principal", () => {
    const installments = [open(1, "2027-02-01", 80000n, 20000n)];
    const ref = isoDate("2027-02-16");
    expect(allocatePayment(cents(1000n), installments, terms, ref)).toEqual([
      { installmentNumber: 1, lateCharges: 1000n, interest: 0n, principal: 0n, status: "PARTIAL" },
    ]);
    expect(allocatePayment(cents(12500n), installments, terms, ref)).toEqual([
      { installmentNumber: 1, lateCharges: 2500n, interest: 10000n, principal: 0n, status: "PARTIAL" },
    ]);
    expect(allocatePayment(cents(22600n), installments, terms, ref)).toEqual([
      { installmentNumber: 1, lateCharges: 2500n, interest: 20000n, principal: 100n, status: "PARTIAL" },
    ]);
  });

  it("RN-R02: the oldest installment goes first regardless of input order; ties by number", () => {
    const installments = [
      open(3, "2027-04-01", 50000n, 0n),
      open(2, "2027-03-01", 50000n, 0n),
      open(1, "2027-03-01", 50000n, 0n),
    ];
    expect(
      allocatePayment(cents(100000n), installments, terms, isoDate("2027-01-15")).map((a) => a.installmentNumber),
    ).toEqual([1, 2]);
  });

  it("RN-R03: skips installments already paid and stops when the payment runs out", () => {
    const installments = [
      open(1, "2027-02-01", 0n, 0n),
      open(2, "2027-03-01", 50000n, 10000n),
      open(3, "2027-04-01", 50000n, 10000n),
    ];
    const result = allocatePayment(cents(60000n), installments, terms, isoDate("2027-01-15"));
    expect(result).toEqual([
      { installmentNumber: 2, lateCharges: 0n, interest: 10000n, principal: 50000n, status: "PAID" },
    ]);
  });

  it("RN-C08: paying exactly the outstanding balance pays everything", () => {
    const installments = [open(1, "2027-02-01", 83333n, 31667n), open(2, "2027-03-01", 83335n, 31665n)];
    const result = allocatePayment(cents(233000n), installments, terms, isoDate("2027-02-16"));
    expect(result.map((a) => a.status)).toEqual(["PAID", "PAID"]);
    expect(result[0]?.lateCharges).toBe(3000n);
  });

  it("T-06: a payment above the outstanding balance is refused with PAYMENT_EXCEEDS_BALANCE", () => {
    const installments = [open(1, "2027-02-01", 83333n, 31667n)];
    expect(errorCode(() => allocatePayment(cents(115001n), installments, terms, isoDate("2027-01-15")))).toBe(
      "PAYMENT_EXCEEDS_BALANCE",
    );
    expect(errorCode(() => allocatePayment(cents(1n), [], terms, isoDate("2027-01-15")))).toBe(
      "PAYMENT_EXCEEDS_BALANCE",
    );
  });

  it("rejects zero or negative payments", () => {
    const installments = [open(1, "2027-02-01", 83333n, 31667n)];
    expect(errorCode(() => allocatePayment(cents(0n), installments, terms, isoDate("2027-01-15")))).toBe(
      "INVALID_PAYMENT",
    );
    expect(errorCode(() => allocatePayment(cents(-1n), installments, terms, isoDate("2027-01-15")))).toBe(
      "INVALID_PAYMENT",
    );
  });

  it("AllocationError keeps the code and uses it as default message", () => {
    expect(new AllocationError("PAYMENT_EXCEEDS_BALANCE").message).toBe("PAYMENT_EXCEEDS_BALANCE");
    expect(new AllocationError("INVALID_PAYMENT", "x").message).toBe("x");
    expect(
      errorCode(() => {
        throw new Error("other");
      }),
    ).toBeUndefined();
  });
});
