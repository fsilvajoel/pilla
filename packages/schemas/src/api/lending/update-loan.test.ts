import { describe, expect, it } from "vitest";
import { updateLoanRequest } from "./update-loan";

describe("updateLoanRequest (E10-F03, A11)", () => {
  it("C18: accepts a partial of the create fields", () => {
    const parsed = updateLoanRequest.parse({ principalCents: 120000, lateFeeBps: 300 });
    expect(parsed).toEqual({ principalCents: 120000, lateFeeBps: 300 });
  });

  it("C18: accepts the full set of editable fields and an empty object", () => {
    const full = {
      type: "INSTALLMENT",
      principalCents: 500000,
      monthlyInterestRateBps: 633,
      installmentCount: 6,
      frequency: { unit: "MONTH", interval: 1 },
      firstDueDate: "2026-12-14",
      lateFeeBps: 200,
      lateInterestMonthlyBps: 100,
      gracePeriodDays: 2,
      internalNotes: "cliente antigo",
    };
    expect(updateLoanRequest.parse(full)).toEqual(full);
    expect(updateLoanRequest.parse({})).toEqual({});
  });

  it("C19: rejects personId", () => {
    const result = updateLoanRequest.safeParse({ personId: "01970000-0000-7000-8000-000000000001" });
    expect(result.success).toBe(false);
  });

  it("C19: rejects unknown keys", () => {
    const result = updateLoanRequest.safeParse({ principalCents: 1000, status: "ACTIVE" });
    expect(result.success).toBe(false);
  });

  it("C20: rejects invalid values and SINGLE_PAYMENT with more than one installment", () => {
    expect(updateLoanRequest.safeParse({ principalCents: 0 }).success).toBe(false);
    expect(updateLoanRequest.safeParse({ installmentCount: 0 }).success).toBe(false);
    expect(updateLoanRequest.safeParse({ firstDueDate: "2026-02-30" }).success).toBe(false);
    expect(updateLoanRequest.safeParse({ type: "INTEREST_ONLY" }).success).toBe(false);
    expect(updateLoanRequest.safeParse({ type: "SINGLE_PAYMENT", installmentCount: 3 }).success).toBe(false);
    expect(updateLoanRequest.safeParse({ type: "SINGLE_PAYMENT", installmentCount: 1 }).success).toBe(true);
  });
});
