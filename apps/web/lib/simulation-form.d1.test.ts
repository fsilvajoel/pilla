import { describe, expect, it } from "vitest";
import type { SimulationFormValues } from "./simulation-form";
import { FormInputError, toSimulateRequest } from "./simulation-form";

const base: SimulationFormValues = {
  amount: "5.000,00",
  monthlyRate: "6,33",
  installmentCount: "6",
  frequency: "MONTHLY",
  firstDueDate: "2026-12-14",
};

describe("D1: installmentCount aceita somente dígitos inteiros", () => {
  it.each(["1e1", " 6 ", "6 ", " 6", "0x6", "+6", "6.0", "1_0"])("rejeita %j", (installmentCount) => {
    expect(() => toSimulateRequest({ ...base, installmentCount })).toThrow(FormInputError);
    expect(() => toSimulateRequest({ ...base, installmentCount })).toThrow("Use somente números inteiros");
  });
});
