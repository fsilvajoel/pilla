import { describe, expect, it } from "vitest";
import { DueDateError, isoDate } from "@pilla/finance";
import type { SimulateLoanRequest } from "@pilla/schemas";
import { frequencyOf, simulate } from "./simulation";

describe("frequencyOf", () => {
  it("gives DAY 7 for WEEKLY", () => {
    expect(frequencyOf("WEEKLY")).toEqual({ unit: "DAY", interval: 7 });
  });

  it("gives DAY 15 for BIWEEKLY", () => {
    expect(frequencyOf("BIWEEKLY")).toEqual({ unit: "DAY", interval: 15 });
  });

  it("gives MONTH 1 for MONTHLY", () => {
    expect(frequencyOf("MONTHLY")).toEqual({ unit: "MONTH", interval: 1 });
  });

  it("gives MONTH 2 for BIMONTHLY", () => {
    expect(frequencyOf("BIMONTHLY")).toEqual({ unit: "MONTH", interval: 2 });
  });
});

describe("simulate", () => {
  const disbursementDate = isoDate("2026-11-14");

  const rfcRequest: SimulateLoanRequest = {
    type: "INSTALLMENT",
    principalCents: 500000,
    monthlyInterestRateBps: 633,
    installmentCount: 6,
    frequency: { unit: "MONTH", interval: 1 },
    firstDueDate: "2026-12-14",
  };

  it("RFC-004 §5 example gives interest 190000n total 690000n installmentAmount 115000n", () => {
    const result = simulate(rfcRequest, disbursementDate);
    expect(result.interest).toBe(190000n);
    expect(result.total).toBe(690000n);
    expect(result.installmentAmount).toBe(115000n);
  });

  it("RFC-004 §5 example schedule has length 6 and first line matches", () => {
    const result = simulate(rfcRequest, disbursementDate);
    expect(result.schedule).toHaveLength(6);
    expect(result.schedule[0]).toEqual({
      number: 1,
      dueDate: "2026-12-14",
      principal: 83333n,
      interest: 31667n,
      total: 115000n,
    });
  });

  const ca11Request: SimulateLoanRequest = {
    type: "INSTALLMENT",
    principalCents: 100000,
    monthlyInterestRateBps: 1000,
    installmentCount: 4,
    frequency: { unit: "DAY", interval: 7 },
    firstDueDate: "2026-11-21",
  };

  it("CA-11 gives installmentAmount 27500n and total 110000n", () => {
    const result = simulate(ca11Request, disbursementDate);
    expect(result.installmentAmount).toBe(27500n);
    expect(result.total).toBe(110000n);
  });

  it("throws DueDateError when firstDueDate equals disbursementDate", () => {
    const badRequest: SimulateLoanRequest = {
      ...rfcRequest,
      firstDueDate: "2026-11-14",
    };
    expect(() => simulate(badRequest, disbursementDate)).toThrow(DueDateError);
  });
});
