import { describe, expect, it } from "vitest";
import { isReversalBlocked, reopensOnReversal } from "./reversal";

describe("isReversalBlocked", () => {
  it("returns true for RENEWED", () => {
    expect(isReversalBlocked("RENEWED")).toBe(true);
  });

  it("returns true for RENEGOTIATED", () => {
    expect(isReversalBlocked("RENEGOTIATED")).toBe(true);
  });

  it("returns false for ACTIVE", () => {
    expect(isReversalBlocked("ACTIVE")).toBe(false);
  });

  it("returns false for PAID_OFF", () => {
    expect(isReversalBlocked("PAID_OFF")).toBe(false);
  });

  it("returns false for WRITTEN_OFF", () => {
    expect(isReversalBlocked("WRITTEN_OFF")).toBe(false);
  });
});

describe("reopensOnReversal", () => {
  it("returns true for PAID_OFF with 1n", () => {
    expect(reopensOnReversal("PAID_OFF", 1n)).toBe(true);
  });

  it("returns false for PAID_OFF with 0n", () => {
    expect(reopensOnReversal("PAID_OFF", 0n)).toBe(false);
  });

  it("returns false for ACTIVE with 500n", () => {
    expect(reopensOnReversal("ACTIVE", 500n)).toBe(false);
  });
});
