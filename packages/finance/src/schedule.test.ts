import { describe, expect, it } from "vitest";
import { isoDate } from "./date";
import type { Frequency } from "./due-dates";
import { DueDateError } from "./due-dates";
import { bps, cents } from "./money";
import { generateSchedule, pairUp, periodsFor, ScheduleError } from "./schedule";
import type { ScheduleInput, ScheduleTerms } from "./schedule";

const monthly: Frequency = { unit: "MONTH", interval: 1 };
const base = {
  disbursementDate: isoDate("2027-01-01"),
  firstDueDate: isoDate("2027-02-01"),
  frequency: monthly,
  roundingStep: cents(500n),
};

function installment(
  principal: bigint,
  rateBps: bigint,
  count: number,
  extra: Partial<ScheduleTerms> = {},
): ScheduleInput {
  return {
    ...base,
    principal: cents(principal),
    monthlyInterestRate: bps(rateBps),
    ...extra,
    type: "INSTALLMENT",
    count,
  };
}

const sum = (values: bigint[]): bigint => values.reduce((a, b) => a + b, 0n);

describe("generateSchedule", () => {
  it("CA-01: 5.000,00 at 6,33% x 6 -> installment 1.150,00, total 6.900,00", () => {
    const schedule = generateSchedule(installment(500000n, 633n, 6));
    expect(schedule).toHaveLength(6);
    expect(schedule.map((i) => i.total)).toEqual(Array(6).fill(115000n));
    expect(sum(schedule.map((i) => i.total))).toBe(690000n);
    expect(schedule.map((i) => i.dueDate)).toEqual([
      "2027-02-01",
      "2027-03-01",
      "2027-04-01",
      "2027-05-01",
      "2027-06-01",
      "2027-07-01",
    ]);
    expect(schedule.map((i) => i.number)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("T-14: CA-01 principal 83.333 x5 + 83.335; interest = 115.000 - principal", () => {
    const schedule = generateSchedule(installment(500000n, 633n, 6));
    expect(schedule.map((i) => i.principal)).toEqual([83333n, 83333n, 83333n, 83333n, 83333n, 83335n]);
    expect(schedule.map((i) => i.interest)).toEqual([31667n, 31667n, 31667n, 31667n, 31667n, 31665n]);
    expect(sum(schedule.map((i) => i.principal))).toBe(500000n);
    expect(sum(schedule.map((i) => i.interest))).toBe(190000n);
  });

  it("RN-C03: CA-02 2.000,00 at 6,25% x 4 -> 4 x 625,00", () => {
    const schedule = generateSchedule(installment(200000n, 625n, 4));
    expect(schedule.map((i) => i.total)).toEqual([62500n, 62500n, 62500n, 62500n]);
    expect(schedule.map((i) => i.principal)).toEqual([50000n, 50000n, 50000n, 50000n]);
  });

  it("RN-C03: CA-03 27.965,50 at 7,45% x 10 -> interest 20.835, installment 4.880,00, total 48.800,00", () => {
    const schedule = generateSchedule(installment(2796550n, 745n, 10));
    // juros exatos 2.083.429,75 -> 2.083.430 -> 2.083.500; (2.796.550 + 2.083.500) / 10 = 488.005 -> 488.000
    expect(schedule.map((i) => i.total)).toEqual(Array(10).fill(488000n));
    expect(sum(schedule.map((i) => i.interest))).toBe(4880000n - 2796550n);
    expect(schedule.map((i) => i.principal)).toEqual(Array(10).fill(279655n));
  });

  it("T-11: 1.000,00 at 10%, every 7 days, n = 4 -> 27.500 each, total 110.000", () => {
    const schedule = generateSchedule(
      installment(100000n, 1000n, 4, { frequency: { unit: "DAY", interval: 7 }, firstDueDate: isoDate("2027-01-08") }),
    );
    // juros exatos 9.333 -> 9.500; 109.500 / 4 = 27.375 -> 27.500
    expect(schedule.map((i) => i.total)).toEqual([27500n, 27500n, 27500n, 27500n]);
    expect(schedule.map((i) => i.interest)).toEqual([2500n, 2500n, 2500n, 2500n]);
    expect(schedule.map((i) => i.dueDate)).toEqual(["2027-01-08", "2027-01-15", "2027-01-22", "2027-01-29"]);
  });

  it("T-12: CA-01 with DAY 30 instead of MONTH 1 gives the same total (factor = 1)", () => {
    const schedule = generateSchedule(installment(500000n, 633n, 6, { frequency: { unit: "DAY", interval: 30 } }));
    expect(sum(schedule.map((i) => i.total))).toBe(690000n);
    expect(schedule.map((i) => i.total)).toEqual(Array(6).fill(115000n));
  });

  it("RN-C03: installment rounds to the nearest step, tie goes up", () => {
    // 1.000,00 at 0% x 8 = 125,00 each: exactly a multiple of 5 -> stays
    expect(generateSchedule(installment(100000n, 0n, 8))[0]?.total).toBe(12500n);
    // 2.000,00 at 1% x 8: juros 160,00 -> 160,00; 2.160,00 / 8 = 270,00 -> stays
    expect(generateSchedule(installment(200000n, 100n, 8))[0]?.total).toBe(27000n);
    // 1.000,00 at 1% x 4: juros 40,00; 1.040,00 / 4 = 260,00
    expect(generateSchedule(installment(100000n, 100n, 4))[0]?.total).toBe(26000n);
    // 1.090,00 / 4 = 272,50 (tie) -> 275,00: principal 1.050,00 at 1% x 4 -> juros 42,00 -> 40,00; 1.090,00
    expect(generateSchedule(installment(105000n, 100n, 4))[0]?.total).toBe(27500n);
    // 1.089,00 / 4 = 272,25 -> 270,00: 1.049,00 at 1% x 4 -> juros 41,96 -> 40,00; 1.089,00
    expect(generateSchedule(installment(104900n, 100n, 4))[0]?.total).toBe(27000n);
  });

  it("RN-C03: odd step rounds the exact quotient, not a truncated one", () => {
    // passo 3: total 3 / 2 = 1,5 (empate) -> 3; truncar daria 1 -> 0
    const schedule = generateSchedule(installment(3n, 0n, 2, { roundingStep: cents(3n) }));
    expect(schedule.map((i) => i.total)).toEqual([3n, 3n]);
    expect(schedule.map((i) => i.interest)).toEqual([2n, 1n]);
    // total 4 / 3 = 1,33 -> 0 or 3: 1,33 < 1,5 -> 0 would leave negative interest
    expect(() => generateSchedule(installment(4n, 0n, 3, { roundingStep: cents(3n) }))).toThrow(ScheduleError);
  });

  it("SINGLE_PAYMENT: CA-04 5.000,00 at 10% for 1 month -> one installment of 5.500,00", () => {
    const schedule = generateSchedule({
      ...base,
      type: "SINGLE_PAYMENT",
      principal: cents(500000n),
      monthlyInterestRate: bps(1000n),
    });
    expect(schedule).toEqual([
      { number: 1, dueDate: "2027-02-01", principal: 500000n, interest: 50000n, total: 550000n },
    ]);
  });

  it("SINGLE_PAYMENT: term of 15 days charges half a month", () => {
    const schedule = generateSchedule({
      ...base,
      type: "SINGLE_PAYMENT",
      principal: cents(100000n),
      monthlyInterestRate: bps(1000n),
      frequency: { unit: "DAY", interval: 15 },
      firstDueDate: isoDate("2027-01-16"),
    });
    expect(schedule[0]?.total).toBe(105000n);
  });

  it("T-04: INTEREST_ONLY 8.000,00 at 10% -> only the next period, interest 800,00", () => {
    const schedule = generateSchedule({
      ...base,
      type: "INTEREST_ONLY",
      principal: cents(800000n),
      monthlyInterestRate: bps(1000n),
    });
    expect(schedule).toEqual([{ number: 1, dueDate: "2027-02-01", principal: 0n, interest: 80000n, total: 80000n }]);
  });

  it("RN-C03: INTEREST_ONLY period interest rounds to the step", () => {
    // 1.000,00 at 6,33% = 63,30 -> 65,00
    const schedule = generateSchedule({
      ...base,
      type: "INTEREST_ONLY",
      principal: cents(100000n),
      monthlyInterestRate: bps(633n),
    });
    expect(schedule[0]?.interest).toBe(6500n);
  });

  it("rejects non-positive principal and invalid due dates", () => {
    expect(() => generateSchedule(installment(0n, 633n, 6))).toThrow(ScheduleError);
    expect(() => generateSchedule(installment(-1n, 633n, 6))).toThrow(ScheduleError);
    expect(() => generateSchedule(installment(500000n, 633n, 0))).toThrow(DueDateError);
    expect(() => generateSchedule(installment(500000n, 633n, 6, { firstDueDate: isoDate("2027-01-01") }))).toThrow(
      DueDateError,
    );
  });

  it("ScheduleError carries its code", () => {
    expect(new ScheduleError().code).toBe("INVALID_SCHEDULE");
  });
});

describe("periodsFor", () => {
  it("RN-C02: MONTH counts months, DAY counts days / 30", () => {
    expect(periodsFor({ unit: "MONTH", interval: 2 }, 3)).toEqual({ numerator: 6n, denominator: 1n });
    expect(periodsFor({ unit: "DAY", interval: 7 }, 4)).toEqual({ numerator: 28n, denominator: 30n });
  });
});

describe("pairUp", () => {
  it("pairs lists of the same length and rejects different lengths", () => {
    expect(pairUp(["a", "b"], [1, 2])).toEqual([
      ["a", 1],
      ["b", 2],
    ]);
    expect(() => pairUp(["a", "b"], [1])).toThrow(ScheduleError);
    expect(() => pairUp(["a"], [1, 2])).toThrow(ScheduleError);
  });
});
