import { describe, expect, it } from "vitest";
import { cents } from "./money";
import { RoundingError, roundToStep } from "./rounding";

const STEP = cents(500n);

describe("roundToStep (RN-C03)", () => {
  it.each([
    [9100n, 9000n],
    [9250n, 9500n],
    [9333n, 9500n],
    [9749n, 9500n],
  ])("T-13: %s with step 500 = %s", (value, expected) => {
    expect(roundToStep(cents(value), STEP)).toBe(expected);
  });

  it("CA-01: interest 189.900 rounds to 190.000", () => {
    expect(roundToStep(cents(189900n), STEP)).toBe(190000n);
  });

  it("keeps exact multiples and zero", () => {
    expect(roundToStep(cents(115000n), STEP)).toBe(115000n);
    expect(roundToStep(cents(0n), STEP)).toBe(0n);
  });

  it("tie rounds up", () => {
    expect(roundToStep(cents(250n), STEP)).toBe(500n);
    expect(roundToStep(cents(50n), cents(100n))).toBe(100n);
  });

  it("works with other steps", () => {
    expect(roundToStep(cents(1234n), cents(100n))).toBe(1200n);
    expect(roundToStep(cents(1234n), cents(1n))).toBe(1234n);
  });

  it("rejects step <= 0 and negative values", () => {
    expect(() => roundToStep(cents(100n), cents(0n))).toThrow(RoundingError);
    expect(() => roundToStep(cents(100n), cents(-500n))).toThrow(RoundingError);
    expect(() => roundToStep(cents(-1n), STEP)).toThrow(RoundingError);
  });
});
