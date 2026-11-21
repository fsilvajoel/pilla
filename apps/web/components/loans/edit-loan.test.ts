import { describe, expect, it } from "vitest";
import type { LoanDetailResponse } from "@pilla/schemas";
import { editLoanFormDefaults, presetOfFrequency, toUpdateLoanRequest } from "./edit-loan";

const loan = {
  principalCents: 500000,
  monthlyInterestRateBps: 633,
  installmentCount: 6,
  frequency: { unit: "DAY", interval: 15 },
  firstDueDate: "2026-12-20",
  lateFeeBps: 200,
  lateInterestMonthlyBps: 100,
  gracePeriodDays: 0,
} as LoanDetailResponse;

describe("edit loan form", () => {
  it("fills the form from the loan detail", () => {
    const values = editLoanFormDefaults(loan);
    expect(values).toMatchObject({
      monthlyRate: "6,33",
      installmentCount: "6",
      frequency: "BIWEEKLY",
      lateFee: "2,00",
    });
    expect(values.internalNotes).toBe("");
  });

  it("round-trips the defaults into a PATCH body without type or empty notes", () => {
    expect(toUpdateLoanRequest(editLoanFormDefaults(loan), "INSTALLMENT")).toEqual({
      principalCents: 500000,
      monthlyInterestRateBps: 633,
      installmentCount: 6,
      frequency: { unit: "DAY", interval: 15 },
      firstDueDate: "2026-12-20",
      lateFeeBps: 200,
      lateInterestMonthlyBps: 100,
      gracePeriodDays: 0,
    });
  });

  it("omits installmentCount for SINGLE_PAYMENT and sends typed notes", () => {
    const body = toUpdateLoanRequest(
      { ...editLoanFormDefaults(loan), installmentCount: "1", internalNotes: "obs" },
      "SINGLE_PAYMENT",
    );
    expect(body.installmentCount).toBeUndefined();
    expect(body.internalNotes).toBe("obs");
  });

  it("falls back to MONTHLY for an unknown frequency", () => {
    expect(presetOfFrequency({ unit: "DAY", interval: 3 })).toBe("MONTHLY");
  });
});
