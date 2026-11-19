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

describe("D1/D2: bordas válidas e rejeições que já existiam", () => {
  it("aceita taxa no limite 99,99 e mínimo 0,01", () => {
    expect(toSimulateRequest({ ...base, monthlyRate: "99,99" }).monthlyInterestRateBps).toBe(9999);
    expect(toSimulateRequest({ ...base, monthlyRate: "0,01" }).monthlyInterestRateBps).toBe(1);
    expect(toSimulateRequest({ ...base, monthlyRate: "6,33" }).monthlyInterestRateBps).toBe(633);
  });
  it("aceita parcelas só com dígitos", () => {
    expect(toSimulateRequest({ ...base, installmentCount: "1" }).installmentCount).toBe(1);
    expect(toSimulateRequest({ ...base, installmentCount: "10" }).installmentCount).toBe(10);
  });
  it.each(["", "-1", "6.5", "abc", "0"])("rejeita parcelas %j", (installmentCount) => {
    expect(() => toSimulateRequest({ ...base, installmentCount })).toThrow();
  });
  it.each(["", "6", "6,3", "-1,00", "6.33", "abc"])("rejeita taxa %j", (monthlyRate) => {
    expect(() => toSimulateRequest({ ...base, monthlyRate })).toThrow(FormInputError);
  });
});
