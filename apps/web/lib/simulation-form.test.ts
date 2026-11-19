import { describe, expect, it } from "vitest";
import { MoneyError } from "@pilla/finance";
import { ZodError } from "zod";
import type { SimulationFormValues } from "./simulation-form";
import { FormInputError, toSimulateRequest } from "./simulation-form";

describe("toSimulateRequest", () => {
  const rfcForm: SimulationFormValues = {
    amount: "5.000,00",
    monthlyRate: "6,33",
    installmentCount: "6",
    frequency: "MONTHLY",
    firstDueDate: "2026-12-14",
  };

  it("C5 (A4): RFC-004 §5 form gives expected SimulateLoanRequest", () => {
    const result = toSimulateRequest(rfcForm);
    expect(result).toEqual({
      type: "INSTALLMENT",
      principalCents: 500000,
      monthlyInterestRateBps: 633,
      installmentCount: 6,
      frequency: { unit: "MONTH", interval: 1 },
      firstDueDate: "2026-12-14",
    });
  });

  const ca11Form: SimulationFormValues = {
    amount: "1.000,00",
    monthlyRate: "10,00",
    installmentCount: "4",
    frequency: "WEEKLY",
    firstDueDate: "2026-11-21",
  };

  it("C5 (A4): CA-11 form gives expected SimulateLoanRequest", () => {
    const result = toSimulateRequest(ca11Form);
    expect(result).toEqual({
      type: "INSTALLMENT",
      principalCents: 100000,
      monthlyInterestRateBps: 1000,
      installmentCount: 4,
      frequency: { unit: "DAY", interval: 7 },
      firstDueDate: "2026-11-21",
    });
  });

  it("C6 (A4): amount without comma throws MoneyError", () => {
    const badForm: SimulationFormValues = {
      ...rfcForm,
      amount: "5000",
    };
    expect(() => toSimulateRequest(badForm)).toThrow(MoneyError);
  });

  it("C6 (A4): installmentCount zero throws ZodError", () => {
    const badForm: SimulationFormValues = {
      ...rfcForm,
      installmentCount: "0",
    };
    expect(() => toSimulateRequest(badForm)).toThrow(ZodError);
  });

  it.each(["6", "-6,33"])("D3 (A4): monthlyRate %j outside the format throws FormInputError", (monthlyRate) => {
    const badForm: SimulationFormValues = {
      ...rfcForm,
      monthlyRate,
    };
    expect(() => toSimulateRequest(badForm)).toThrow(FormInputError);
    expect(() => toSimulateRequest(badForm)).toThrow("Taxa deve ser até 99,99%");
  });
});
