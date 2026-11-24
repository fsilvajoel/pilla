import { describe, expect, it } from "vitest";
import { committedShares } from "./committed-shares";

describe("committedShares", () => {
  it("computes committed and available shares, rounding committed down", () => {
    expect(committedShares(7_000_000, 3_000_000)).toEqual({ committedBps: 3000, availableBps: 7000 });
    expect(committedShares(2, 1)).toEqual({ committedBps: 3333, availableBps: 6667 });
  });

  it("returns 100% committed when cash is zero and there is lent money", () => {
    expect(committedShares(0, 500)).toEqual({ committedBps: 10000, availableBps: 0 });
  });

  it("returns nulls when cash is negative even if the base is positive", () => {
    expect(committedShares(-4_000, 5_000)).toEqual({ committedBps: null, availableBps: null });
  });

  it("returns nulls when the base is zero or negative", () => {
    expect(committedShares(0, 0)).toEqual({ committedBps: null, availableBps: null });
    expect(committedShares(-5_000, 5_000)).toEqual({ committedBps: null, availableBps: null });
    expect(committedShares(-6_000, 5_000)).toEqual({ committedBps: null, availableBps: null });
  });
});
