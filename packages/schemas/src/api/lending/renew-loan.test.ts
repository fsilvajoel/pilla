import { describe, expect, it } from "vitest";
import { renewLoanRequest } from "./renew-loan";

describe("renewLoanRequest (E10-F06, A9)", () => {
  it("C15: requires firstDueDate", () => {
    expect(renewLoanRequest.safeParse({}).success).toBe(false);
    expect(renewLoanRequest.safeParse({ monthlyInterestRateBps: 500 }).success).toBe(false);
    expect(renewLoanRequest.parse({ firstDueDate: "2027-01-15" })).toEqual({ firstDueDate: "2027-01-15" });
  });

  it("C15: accepts rate, count and frequency adjustments", () => {
    const full = {
      firstDueDate: "2027-01-15",
      monthlyInterestRateBps: 500,
      installmentCount: 4,
      frequency: { unit: "DAY", interval: 15 },
    };
    expect(renewLoanRequest.parse(full)).toEqual(full);
  });

  it("C16: rejects fields outside the adjustments", () => {
    const base = { firstDueDate: "2027-01-15" };
    expect(renewLoanRequest.safeParse({ ...base, principalCents: 1000 }).success).toBe(false);
    expect(renewLoanRequest.safeParse({ ...base, personId: "01970000-0000-7000-8000-000000000001" }).success).toBe(
      false,
    );
    expect(renewLoanRequest.safeParse({ ...base, type: "INSTALLMENT" }).success).toBe(false);
    expect(renewLoanRequest.safeParse({ ...base, capitalizedAmountCents: 100 }).success).toBe(false);
  });

  it("C16: rejects invalid values", () => {
    const base = { firstDueDate: "2027-01-15" };
    expect(renewLoanRequest.safeParse({ firstDueDate: "2027-02-30" }).success).toBe(false);
    expect(renewLoanRequest.safeParse({ firstDueDate: "15/01/2027" }).success).toBe(false);
    expect(renewLoanRequest.safeParse({ ...base, monthlyInterestRateBps: -1 }).success).toBe(false);
    expect(renewLoanRequest.safeParse({ ...base, installmentCount: 0 }).success).toBe(false);
    expect(renewLoanRequest.safeParse({ ...base, frequency: { unit: "YEAR", interval: 1 } }).success).toBe(false);
    expect(renewLoanRequest.safeParse({ ...base, frequency: { unit: "MONTH", interval: 0 } }).success).toBe(false);
  });
});
