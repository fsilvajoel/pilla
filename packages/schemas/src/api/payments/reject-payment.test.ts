import { describe, expect, it } from "vitest";
import { paymentStatusSchema } from "./payment-views";
import { rejectPaymentRequest } from "./reject-payment";

describe("rejectPaymentRequest (RFC-004 §3, E11 D9)", () => {
  it("C19 (A16): accepts exactly a reason and trims it", () => {
    const parsed = rejectPaymentRequest.safeParse({ reason: "  valor digitado errado  " });
    expect(parsed.success).toBe(true);
    expect(parsed.data).toEqual({ reason: "valor digitado errado" });
  });

  it.each([
    ["no key", {}],
    ["an empty reason", { reason: "" }],
    ["a blank reason", { reason: "   " }],
    ["a number as reason", { reason: 5 }],
    ["a null reason", { reason: null }],
    ["a reason above 500 characters", { reason: "a".repeat(501) }],
  ])("C19 (A16): rejects %s", (_label, body) => {
    expect(rejectPaymentRequest.safeParse(body).success).toBe(false);
  });

  it.each([
    ["status", "REJECTED"],
    ["rejectedBy", "x"],
    ["version", 1],
  ])("C20 (A16): is strict and refuses the key %s", (key, value) => {
    expect(rejectPaymentRequest.safeParse({ reason: "engano", [key]: value }).success).toBe(false);
  });
});

describe("paymentStatusSchema with REJECTED (RFC-005 §5)", () => {
  it.each(["PENDING_REVIEW", "CONFIRMED", "REVERSED", "REJECTED"])("C19 (A16): accepts %s", (status) => {
    expect(paymentStatusSchema.safeParse(status).success).toBe(true);
  });

  it.each(["rejected", "CANCELLED", "PAID", ""])("C20 (A16): refuses %j", (status) => {
    expect(paymentStatusSchema.safeParse(status).success).toBe(false);
  });
});
