import { describe, expect, it } from "vitest";
import { MoneyError } from "@pilla/finance";
import { ZodError } from "zod";
import { mockDefaultTerms } from "@/lib/mock-data";
import type { NewLoanFormValues } from "./new-loan";
import { newLoanFormDefaults, toCreateLoanRequest } from "./new-loan";

describe("new loan form", () => {
  const example: NewLoanFormValues = {
    amount: "5.000,00",
    monthlyRate: "6,33",
    installmentCount: "6",
    frequency: "MONTHLY",
    firstDueDate: "2026-12-14",
    personId: "01936f8e-7b2c-7cde-8f00-000000000001",
    lateFee: "2,00",
    lateInterest: "1,00",
    gracePeriodDays: "0",
    internalNotes: "",
  };
  const request = {
    personId: "01936f8e-7b2c-7cde-8f00-000000000001",
    type: "INSTALLMENT",
    principalCents: 500000,
    monthlyInterestRateBps: 633,
    installmentCount: 6,
    frequency: { unit: "MONTH", interval: 1 },
    firstDueDate: "2026-12-14",
    lateFeeBps: 200,
    lateInterestMonthlyBps: 100,
    gracePeriodDays: 0,
  };

  it("fills the default terms", () => {
    expect(newLoanFormDefaults(mockDefaultTerms)).toStrictEqual({
      amount: "",
      monthlyRate: "6,33",
      installmentCount: "",
      frequency: "MONTHLY",
      firstDueDate: "",
      personId: "",
      lateFee: "2,00",
      lateInterest: "1,00",
      gracePeriodDays: "0",
      internalNotes: "",
    });
  });

  it("builds the RFC-004 example", () => {
    expect(toCreateLoanRequest(example)).toStrictEqual(request);
  });

  it("keeps the internal notes", () => {
    expect(toCreateLoanRequest({ ...example, internalNotes: "cliente antigo" })).toStrictEqual({
      ...request,
      internalNotes: "cliente antigo",
    });
    expect(toCreateLoanRequest(example)).toStrictEqual(request);
  });

  it("rejects bad input", () => {
    expect(() => toCreateLoanRequest({ ...example, personId: "" })).toThrow(ZodError);
    expect(() => toCreateLoanRequest({ ...example, lateFee: "2" })).toThrow(MoneyError);
  });
});
