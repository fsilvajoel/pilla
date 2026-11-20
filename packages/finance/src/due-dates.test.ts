import { describe, expect, it } from "vitest";
import { isoDate } from "./date";
import { DueDateError, generateDueDates } from "./due-dates";

const base = { disbursementDate: isoDate("2026-12-20") };

describe("generateDueDates (RN-C04)", () => {
  it("T-08: every 7 days", () => {
    const dates = generateDueDates({
      ...base,
      firstDueDate: isoDate("2027-01-05"),
      frequency: { unit: "DAY", interval: 7 },
      count: 4,
    });
    expect(dates).toEqual(["2027-01-05", "2027-01-12", "2027-01-19", "2027-01-26"]);
  });

  it("T-09: monthly from the 31st keeps returning to month end and back to 31", () => {
    const dates = generateDueDates({
      ...base,
      firstDueDate: isoDate("2027-01-31"),
      frequency: { unit: "MONTH", interval: 1 },
      count: 4,
    });
    expect(dates).toEqual(["2027-01-31", "2027-02-28", "2027-03-31", "2027-04-30"]);
  });

  it("T-10: every 2 months", () => {
    const dates = generateDueDates({
      ...base,
      firstDueDate: isoDate("2027-01-15"),
      frequency: { unit: "MONTH", interval: 2 },
      count: 3,
    });
    expect(dates).toEqual(["2027-01-15", "2027-03-15", "2027-05-15"]);
  });

  it("single installment", () => {
    const dates = generateDueDates({
      ...base,
      firstDueDate: isoDate("2027-01-15"),
      frequency: { unit: "MONTH", interval: 1 },
      count: 1,
    });
    expect(dates).toEqual(["2027-01-15"]);
  });

  it("rejects interval < 1, count < 1 and first due date not after disbursement", () => {
    const ok = {
      ...base,
      firstDueDate: isoDate("2027-01-15"),
      frequency: { unit: "DAY" as const, interval: 7 },
      count: 2,
    };
    expect(() => generateDueDates({ ...ok, frequency: { unit: "DAY", interval: 0 } })).toThrow(DueDateError);
    expect(() => generateDueDates({ ...ok, count: 0 })).toThrow(DueDateError);
    expect(() => generateDueDates({ ...ok, firstDueDate: isoDate("2026-12-20") })).toThrow(DueDateError);
    expect(() => generateDueDates({ ...ok, firstDueDate: isoDate("2026-12-01") })).toThrow(DueDateError);
  });
});
