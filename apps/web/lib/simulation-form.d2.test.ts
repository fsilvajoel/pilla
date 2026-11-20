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

describe("D2: monthlyRate até 99,99, duas casas, sem milhar", () => {
  it.each(["1.000,00", "100,00", "100,01", "99,991", "6,333", "999999,00"])("rejeita %j", (monthlyRate) => {
    expect(() => toSimulateRequest({ ...base, monthlyRate })).toThrow(FormInputError);
    expect(() => toSimulateRequest({ ...base, monthlyRate })).toThrow("Taxa deve ser até 99,99%");
  });
});
