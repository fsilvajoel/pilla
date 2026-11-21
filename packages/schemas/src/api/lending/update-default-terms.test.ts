import { describe, expect, it } from "vitest";
import { updateDefaultTermsRequest } from "./update-default-terms";

const valid = {
  lateFeeBps: 200,
  lateInterestMonthlyBps: 100,
  gracePeriodDays: 0,
  suggestedMonthlyRateBps: 1000,
  roundingStepCents: 500,
};

function rejects(patch: Record<string, unknown>): boolean {
  return !updateDefaultTermsRequest.safeParse({ ...valid, ...patch }).success;
}

describe("updateDefaultTermsRequest (E13-F01, A8)", () => {
  it("C14: accepts the five integer fields, grace 0 included", () => {
    expect(updateDefaultTermsRequest.parse(valid)).toEqual(valid);
  });

  it("C14: accepts the limits of the plano", () => {
    const limits = {
      lateFeeBps: 10000,
      lateInterestMonthlyBps: 10000,
      gracePeriodDays: 365,
      suggestedMonthlyRateBps: 10000,
      roundingStepCents: 100000,
    };
    expect(updateDefaultTermsRequest.parse(limits)).toEqual(limits);
    expect(updateDefaultTermsRequest.parse({ ...valid, lateFeeBps: 0, roundingStepCents: 1 })).toEqual({
      ...valid,
      lateFeeBps: 0,
      roundingStepCents: 1,
    });
  });

  it("C15: rejects a missing field (full replacement, not partial)", () => {
    for (const key of Object.keys(valid)) {
      const rest = Object.fromEntries(Object.entries(valid).filter(([name]) => name !== key));
      expect(updateDefaultTermsRequest.safeParse(rest).success).toBe(false);
    }
    expect(updateDefaultTermsRequest.safeParse({}).success).toBe(false);
  });

  it("C16: rejects negative values", () => {
    for (const key of ["lateFeeBps", "lateInterestMonthlyBps", "gracePeriodDays", "suggestedMonthlyRateBps"]) {
      expect(rejects({ [key]: -1 })).toBe(true);
    }
    expect(rejects({ roundingStepCents: -500 })).toBe(true);
  });

  it("C16: rejects non-integers and numeric strings", () => {
    expect(rejects({ lateFeeBps: 1.5 })).toBe(true);
    expect(rejects({ lateInterestMonthlyBps: 1.5 })).toBe(true);
    expect(rejects({ gracePeriodDays: 2.5 })).toBe(true);
    expect(rejects({ suggestedMonthlyRateBps: 1.5 })).toBe(true);
    expect(rejects({ roundingStepCents: 500.5 })).toBe(true);
    expect(rejects({ lateFeeBps: "200" })).toBe(true);
  });

  it("C17: rejects roundingStepCents 0 and values above the limits", () => {
    expect(rejects({ roundingStepCents: 0 })).toBe(true);
    expect(rejects({ lateFeeBps: 10001 })).toBe(true);
    expect(rejects({ lateInterestMonthlyBps: 10001 })).toBe(true);
    expect(rejects({ gracePeriodDays: 366 })).toBe(true);
    expect(rejects({ suggestedMonthlyRateBps: 10001 })).toBe(true);
    expect(rejects({ roundingStepCents: 100001 })).toBe(true);
  });

  it("C18: rejects unknown keys (strict)", () => {
    expect(rejects({ id: "x" })).toBe(true);
    expect(rejects({ effectiveFrom: "2026-01-01T00:00:00Z" })).toBe(true);
  });
});
