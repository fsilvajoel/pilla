import { describe, expect, it } from "vitest";
import { isClosedForPayments } from "./loan-status";

describe("isClosedForPayments", () => {
  it("returns true for PAID_OFF", () => {
    expect(isClosedForPayments("PAID_OFF")).toBe(true);
  });

  it("returns true for RENEWED", () => {
    expect(isClosedForPayments("RENEWED")).toBe(true);
  });

  it("returns true for RENEGOTIATED", () => {
    expect(isClosedForPayments("RENEGOTIATED")).toBe(true);
  });

  it("returns true for CANCELLED", () => {
    expect(isClosedForPayments("CANCELLED")).toBe(true);
  });

  it("returns false for ACTIVE", () => {
    expect(isClosedForPayments("ACTIVE")).toBe(false);
  });

  it("returns false for WRITTEN_OFF", () => {
    expect(isClosedForPayments("WRITTEN_OFF")).toBe(false);
  });
});
