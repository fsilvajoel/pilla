import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { todayInBrt } from "./today";

const THREE_HOURS_MS = 3 * 60 * 60 * 1000;

describe("todayInBrt", () => {
  it("C1 (A1): gives 2026-11-17 for 2026-11-18T02:30:00Z", () => {
    expect(todayInBrt(new Date("2026-11-18T02:30:00Z"))).toBe("2026-11-17");
  });

  it("C2 (A1): gives 2026-11-17 for 2026-11-17T15:00:00Z", () => {
    expect(todayInBrt(new Date("2026-11-17T15:00:00Z"))).toBe("2026-11-17");
  });

  it("C3 (A1): equals the UTC day of now minus 3 hours for every valid instant", () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date("1990-01-01T00:00:00Z"), max: new Date("2100-12-31T23:59:59Z"), noInvalidDate: true }),
        (now) => {
          const expected = new Date(now.getTime() - THREE_HOURS_MS).toISOString().slice(0, 10);
          expect(todayInBrt(now)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
          expect(todayInBrt(now)).toBe(expected);
        },
      ),
    );
  });

  it("C13 (A1): turns the day exactly at 03:00Z, the UTC−3 boundary", () => {
    expect(todayInBrt(new Date("2026-11-18T02:59:59.999Z"))).toBe("2026-11-17");
    expect(todayInBrt(new Date("2026-11-18T03:00:00.000Z"))).toBe("2026-11-18");
  });

  it("C11 (A4): throws RangeError for an Invalid Date", () => {
    expect(() => todayInBrt(new Date("x"))).toThrow(RangeError);
  });
});
