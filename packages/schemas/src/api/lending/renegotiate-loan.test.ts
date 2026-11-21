import { describe, expect, it } from "vitest";
import { renegotiateLoanRequest } from "./renegotiate-loan";

describe("renegotiateLoanRequest (E10-F06, A9)", () => {
  it("C17: requires firstDueDate", () => {
    expect(renegotiateLoanRequest.safeParse({}).success).toBe(false);
    expect(renegotiateLoanRequest.safeParse({ monthlyInterestRateBps: 500 }).success).toBe(false);
    expect(renegotiateLoanRequest.parse({ firstDueDate: "2027-01-15" })).toEqual({ firstDueDate: "2027-01-15" });
  });

  it("C17: accepts rate, count and frequency adjustments", () => {
    const full = {
      firstDueDate: "2027-01-15",
      monthlyInterestRateBps: 500,
      installmentCount: 4,
      frequency: { unit: "DAY", interval: 15 },
    };
    expect(renegotiateLoanRequest.parse(full)).toEqual(full);
  });

  it("C18: rejects fields outside the adjustments", () => {
    const base = { firstDueDate: "2027-01-15" };
    expect(renegotiateLoanRequest.safeParse({ ...base, principalCents: 1000 }).success).toBe(false);
    expect(
      renegotiateLoanRequest.safeParse({ ...base, personId: "01970000-0000-7000-8000-000000000001" }).success,
    ).toBe(false);
    expect(renegotiateLoanRequest.safeParse({ ...base, type: "INSTALLMENT" }).success).toBe(false);
    expect(renegotiateLoanRequest.safeParse({ ...base, capitalizedAmountCents: 100 }).success).toBe(false);
  });

  it("C18: rejects invalid values", () => {
    const base = { firstDueDate: "2027-01-15" };
    expect(renegotiateLoanRequest.safeParse({ firstDueDate: "2027-02-30" }).success).toBe(false);
    expect(renegotiateLoanRequest.safeParse({ firstDueDate: "15/01/2027" }).success).toBe(false);
    expect(renegotiateLoanRequest.safeParse({ ...base, monthlyInterestRateBps: -1 }).success).toBe(false);
    expect(renegotiateLoanRequest.safeParse({ ...base, installmentCount: 0 }).success).toBe(false);
    expect(renegotiateLoanRequest.safeParse({ ...base, frequency: { unit: "YEAR", interval: 1 } }).success).toBe(false);
    expect(renegotiateLoanRequest.safeParse({ ...base, frequency: { unit: "MONTH", interval: 0 } }).success).toBe(
      false,
    );
  });
});
