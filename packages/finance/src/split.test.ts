import { describe, it, expect } from "vitest";
import { SplitError, splitEvenly } from "./split";
import { cents } from "./money";

describe("splitEvenly", () => {
  it("T-01: should split 689900 into [114983 x5, 114985]", () => {
    const total = cents(689900n);
    const parts = 6;
    const expected = [cents(114983n), cents(114983n), cents(114983n), cents(114983n), cents(114983n), cents(114985n)];
    expect(splitEvenly(total, parts)).toEqual(expected);
  });

  it("T-02: should split 500000 into [83333 x5, 83335]", () => {
    const total = cents(500000n);
    const parts = 6;
    const expected = [cents(83333n), cents(83333n), cents(83333n), cents(83333n), cents(83333n), cents(83335n)];
    expect(splitEvenly(total, parts)).toEqual(expected);
  });

  it("exact division, single part and sum always closes (added in Claude review)", () => {
    expect(splitEvenly(cents(900n), 3)).toEqual([300n, 300n, 300n]);
    expect(splitEvenly(cents(115000n), 1)).toEqual([115000n]);
    const parts = splitEvenly(cents(100001n), 7);
    expect(parts.reduce((a, b) => a + b, 0n)).toBe(100001n);
    expect(splitEvenly(cents(0n), 2)).toEqual([0n, 0n]);
  });

  it("rejects parts < 1 and negative total (added in Claude review)", () => {
    expect(() => splitEvenly(cents(100n), 0)).toThrow(SplitError);
    expect(() => splitEvenly(cents(-1n), 2)).toThrow(SplitError);
  });
});
