import { describe, expect, it } from "vitest";
import { cents, bps } from "./money";
import { isoDate } from "./date";
import { calculateLateCharges } from "./late-charges";

describe("calculateLateCharges", () => {
  const roundingStep = cents(500n);

  describe("RN-E01: Late charges calculation", () => {
    it("RN-E01: calculates fine and late interest correctly", () => {
      const input = {
        openAmount: cents(100000n), // R$ 1.000,00
        dueDate: isoDate("2023-01-01"),
        referenceDate: isoDate("2023-01-31"),
        finePercent: bps(200n), // 2%
        lateInterestMonthlyRate: bps(1000n), // 10%
        graceDays: 0,
        roundingStep: roundingStep,
      };

      // daysBetween = 30
      // fine = 100000 * 200 / 10000 = 2000
      // lateInterest = 100000 * 1000 * 30 / (10000 * 30) = 10000
      // total = roundToStep(2000 + 10000, 500) = 12000
      const result = calculateLateCharges(input);

      expect(result.fine).toBe(cents(2000n));
      expect(result.lateInterest).toBe(cents(10000n));
      expect(result.total).toBe(cents(12000n));
    });
  });

  describe("RN-E02: Calculation on reference date", () => {
    it("RN-E02: calculates charges based on the reference date", () => {
      const input = {
        openAmount: cents(100000n),
        dueDate: isoDate("2023-01-01"),
        referenceDate: isoDate("2023-01-15"), // 14 days late
        finePercent: bps(200n),
        lateInterestMonthlyRate: bps(1000n),
        graceDays: 0,
        roundingStep: roundingStep,
      };

      // daysBetween = 14
      // fine = 100000 * 200 / 10000 = 2000
      // lateInterest = 100000 * 1000 * 14 / (10000 * 30) = 100000 * 1000 * 14 / 300000 = 4666.66... -> 4667
      // total = roundToStep(2000 + 4667 = 6667, 500) = 6500 (revisão do Claude: a Alice tinha 7000)
      const result = calculateLateCharges(input);

      expect(result.fine).toBe(cents(2000n));
      expect(result.lateInterest).toBe(cents(4667n));
      expect(result.total).toBe(cents(6500n));
    });
  });

  describe("T-07: Grace period", () => {
    it("T-07: returns zero charges when days <= grace period", () => {
      const input = {
        openAmount: cents(100000n),
        dueDate: isoDate("2023-01-01"),
        referenceDate: isoDate("2023-01-05"), // 4 days late
        finePercent: bps(200n),
        lateInterestMonthlyRate: bps(1000n),
        graceDays: 5, // grace period is 5
        roundingStep: roundingStep,
      };

      const result = calculateLateCharges(input);

      expect(result.fine).toBe(cents(0n));
      expect(result.lateInterest).toBe(cents(0n));
      expect(result.total).toBe(cents(0n));
    });

    it("T-07: returns zero charges when days = grace period", () => {
      const input = {
        openAmount: cents(100000n),
        dueDate: isoDate("2023-01-01"),
        referenceDate: isoDate("2023-01-06"), // 5 days late
        finePercent: bps(200n),
        lateInterestMonthlyRate: bps(1000n),
        graceDays: 5,
        roundingStep: roundingStep,
      };

      const result = calculateLateCharges(input);

      expect(result.fine).toBe(cents(0n));
      expect(result.lateInterest).toBe(cents(0n));
      expect(result.total).toBe(cents(0n));
    });
  });

  describe("edge cases (added in Claude review)", () => {
    const base = () => ({
      openAmount: cents(100000n),
      dueDate: isoDate("2023-01-01"),
      referenceDate: isoDate("2023-01-07"),
      finePercent: bps(200n),
      lateInterestMonthlyRate: bps(1000n),
      graceDays: 5,
      roundingStep,
    });

    it("T-07: first day after grace counts every late day (6 days)", () => {
      const result = calculateLateCharges(base());
      expect(result.fine).toBe(cents(2000n));
      expect(result.lateInterest).toBe(cents(2000n));
      expect(result.total).toBe(cents(4000n));
    });

    it("RN-E01: nothing open means no charges", () => {
      const result = calculateLateCharges({ ...base(), openAmount: cents(0n) });
      expect(result).toEqual({ fine: 0n, lateInterest: 0n, total: 0n });
    });

    it("RN-E01: fine rounds half up once (333 x 2% = 6,66 -> 7)", () => {
      const result = calculateLateCharges({ ...base(), openAmount: cents(333n), lateInterestMonthlyRate: bps(0n) });
      expect(result.fine).toBe(cents(7n));
      expect(result.lateInterest).toBe(cents(0n));
      expect(result.total).toBe(cents(0n));
    });
  });
});
