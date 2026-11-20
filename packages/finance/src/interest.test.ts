import { describe, expect, it } from "vitest";
import { InterestError, simpleInterest } from "./interest";
import { bps, cents } from "./money";

const months = (numerator: bigint, denominator = 1n) => ({ numerator, denominator });

describe("simpleInterest (RFC-002 §3.1)", () => {
  it("T-03: 5.000,00 at 6,33% for 6 months = 1.899,00", () => {
    expect(simpleInterest(cents(500000n), bps(633n), months(6n))).toBe(189900n);
  });

  it("T-11: 1.000,00 at 10% for 4 x 7 days = exact 93,33", () => {
    expect(simpleInterest(cents(100000n), bps(1000n), months(28n, 30n))).toBe(9333n);
  });

  it("T-04: interest-only period of 8.000,00 at 10% = 800,00", () => {
    expect(simpleInterest(cents(800000n), bps(1000n), months(1n))).toBe(80000n);
  });

  it("rounds half up once", () => {
    expect(simpleInterest(cents(5n), bps(1000n), months(1n))).toBe(1n);
    expect(simpleInterest(cents(4n), bps(1000n), months(1n))).toBe(0n);
    expect(simpleInterest(cents(100000n), bps(1000n), months(2n, 3n))).toBe(6667n);
  });

  it("zero principal, rate or periods gives zero", () => {
    expect(simpleInterest(cents(0n), bps(633n), months(6n))).toBe(0n);
    expect(simpleInterest(cents(500000n), bps(0n), months(6n))).toBe(0n);
    expect(simpleInterest(cents(500000n), bps(633n), months(0n))).toBe(0n);
  });

  it("rejects negative principal, negative periods and non-positive denominator", () => {
    expect(() => simpleInterest(cents(-1n), bps(633n), months(1n))).toThrow(InterestError);
    expect(() => simpleInterest(cents(100n), bps(633n), months(-1n))).toThrow(InterestError);
    expect(() => simpleInterest(cents(100n), bps(633n), months(1n, 0n))).toThrow(InterestError);
  });
});
