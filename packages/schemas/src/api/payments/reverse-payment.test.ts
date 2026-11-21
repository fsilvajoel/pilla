import { describe, expect, it } from "vitest";
import { reversePaymentRequest } from "./reverse-payment";

describe("reversePaymentRequest (RFC-004 §3, E11 D9)", () => {
  it("C21 (A18): accepts exactly a reason and trims it", () => {
    const parsed = reversePaymentRequest.safeParse({ reason: "  pagamento em duplicidade  " });
    expect(parsed.success).toBe(true);
    expect(parsed.data).toEqual({ reason: "pagamento em duplicidade" });
  });

  it.each([
    ["no key", {}],
    ["an empty reason", { reason: "" }],
    ["a blank reason", { reason: "   " }],
    ["a number as reason", { reason: 5 }],
    ["a null reason", { reason: null }],
    ["a reason above 500 characters", { reason: "a".repeat(501) }],
  ])("C21 (A18): rejects %s", (_label, body) => {
    expect(reversePaymentRequest.safeParse(body).success).toBe(false);
  });

  it.each([
    ["status", "REVERSED"],
    ["reversedBy", "x"],
    ["version", 1],
  ])("C22 (A18): is strict and refuses the key %s", (key, value) => {
    expect(reversePaymentRequest.safeParse({ reason: "engano", [key]: value }).success).toBe(false);
  });
});
