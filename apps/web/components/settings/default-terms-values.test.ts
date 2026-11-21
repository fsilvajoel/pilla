import { describe, expect, it } from "vitest";
import { toFormValues, toUpdateRequest } from "./default-terms-values";

const response = {
  lateFeeBps: 200,
  lateInterestMonthlyBps: 100,
  gracePeriodDays: 3,
  suggestedMonthlyRateBps: 633,
  roundingStepCents: 500,
};

describe("default terms form values", () => {
  it("escreve bps e centavos com vírgula", () => {
    expect(toFormValues(response)).toEqual({
      lateFee: "2,00",
      lateInterest: "1,00",
      gracePeriodDays: "3",
      suggestedRate: "6,33",
      roundingStep: "5,00",
    });
  });

  it("volta ao corpo da API em inteiros", () => {
    expect(toUpdateRequest(toFormValues(response))).toEqual({ ok: true, data: response });
  });

  it("aponta o campo fora do formato", () => {
    const result = toUpdateRequest({ ...toFormValues(response), lateFee: "2", gracePeriodDays: "1,5" });
    expect(result).toEqual({
      ok: false,
      fieldErrors: { lateFee: "Use o formato 0,00", gracePeriodDays: "Use somente números inteiros" },
    });
  });
});
