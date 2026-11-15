import { describe, expect, it } from "vitest";
import { addDays, addMonths, DateError, daysBetween, isoDate } from "./date";

const d = (text: string) => isoDate(text);

describe("isoDate", () => {
  it.each(["2027-01-05", "2028-02-29", "1900-01-01", "2999-12-31"])("accepts %s", (text) => {
    expect(isoDate(text)).toBe(text);
  });
  it.each([
    "2027-02-29",
    "2027-13-01",
    "2027-04-31",
    "2027-00-10",
    "27-01-01",
    "2027-1-5",
    "1899-12-31",
    "3000-01-01",
    "",
  ])("rejects %s", (text) => {
    expect(() => isoDate(text)).toThrow(DateError);
  });
  it("treats 1900 as non-leap and 2000 as leap", () => {
    expect(() => isoDate("1900-02-29")).toThrow(DateError);
    expect(isoDate("2000-02-29")).toBe("2000-02-29");
  });
});

describe("addDays", () => {
  it.each([
    ["2027-01-05", 7, "2027-01-12"],
    ["2027-01-26", 7, "2027-02-02"],
    ["2027-12-30", 3, "2028-01-02"],
    ["2028-02-28", 1, "2028-02-29"],
    ["2027-02-28", 1, "2027-03-01"],
    ["2027-03-01", -1, "2027-02-28"],
    ["2027-01-05", 0, "2027-01-05"],
    ["2027-01-01", 365, "2028-01-01"],
  ])("%s + %i days = %s", (from, days, expected) => {
    expect(addDays(d(from), days)).toBe(expected);
  });
});

describe("addMonths (RN-C04: missing day becomes month end)", () => {
  it.each([
    ["2027-01-31", 1, "2027-02-28"],
    ["2027-01-31", 2, "2027-03-31"],
    ["2027-01-31", 3, "2027-04-30"],
    ["2028-01-31", 1, "2028-02-29"],
    ["2027-01-15", 2, "2027-03-15"],
    ["2027-11-15", 3, "2028-02-15"],
    ["2027-01-15", 0, "2027-01-15"],
    ["2027-01-15", 24, "2029-01-15"],
  ])("%s + %i months = %s", (from, months, expected) => {
    expect(addMonths(d(from), months)).toBe(expected);
  });
  it("rejects negative months", () => {
    expect(() => addMonths(d("2027-01-15"), -1)).toThrow(DateError);
  });
});

describe("daysBetween", () => {
  it.each([
    ["2027-01-05", "2027-01-12", 7],
    ["2027-01-12", "2027-01-05", -7],
    ["2027-02-01", "2027-03-01", 28],
    ["2028-02-01", "2028-03-01", 29],
    ["2027-01-01", "2028-01-01", 365],
    ["2027-01-05", "2027-01-05", 0],
  ])("from %s to %s = %i", (from, to, expected) => {
    expect(daysBetween(d(from), d(to))).toBe(expected);
  });
});

describe("calendar edge cases (mutation review)", () => {
  it.each(["2027-06-31", "2027-09-31", "2027-11-31", "2027-01-00", " 2027-01-05", "2027-01-05x", "x2027-01-05"])(
    "rejects %s",
    (text) => {
      expect(() => isoDate(text)).toThrow(DateError);
    },
  );

  it.each(["2027-06-30", "2027-09-30", "2027-11-30", "2027-12-31"])("accepts %s", (text) => {
    expect(isoDate(text)).toBe(text);
  });

  it("century rules: 2100 is not leap, 2400 is leap", () => {
    expect(addDays(isoDate("2100-02-28"), 1)).toBe("2100-03-01");
    expect(daysBetween(isoDate("2099-12-31"), isoDate("2101-01-01"))).toBe(366);
    expect(daysBetween(isoDate("2399-12-31"), isoDate("2401-01-01"))).toBe(367);
    expect(addDays(isoDate("2400-02-28"), 1)).toBe("2400-02-29");
  });

  it("adding many months crosses years correctly", () => {
    expect(addMonths(isoDate("2027-01-15"), 22)).toBe("2028-11-15");
    expect(addMonths(isoDate("2027-12-15"), 1)).toBe("2028-01-15");
  });

  it("errors carry a stable code", () => {
    expect(new DateError("x").code).toBe("INVALID_DATE");
  });
});
