import { describe, expect, it } from "vitest";
import { createPaymentRequest, paymentFieldsSchema } from "./create-payment";

const LOAN = "01936f8e-7b2c-7cde-8f00-000000000002";
const ACCOUNT = "01936f8e-7b2c-7cde-8f00-000000000003";

const payment = { loanId: LOAN, accountId: ACCOUNT, paidAt: "2026-11-20", amountCents: 115000, method: "PIX" };

describe("createPaymentRequest (RFC-004 §3, E11 D2)", () => {
  it("C28 (A20): accepts exactly loanId, accountId, paidAt, amountCents and method", () => {
    const parsed = createPaymentRequest.safeParse(payment);
    expect(parsed.success).toBe(true);
    expect(parsed.data).toEqual(payment);
  });

  it.each(["PIX", "BOLETO", "CASH", "BANK_TRANSFER"])("C28 (A20): accepts the method %s with no receipt", (method) => {
    expect(createPaymentRequest.safeParse({ ...payment, method }).success).toBe(true);
  });

  it.each(Object.keys(payment))("C29 (A20): rejects a body without %s", (key) => {
    const rest = Object.fromEntries(Object.entries(payment).filter(([name]) => name !== key));
    expect(createPaymentRequest.safeParse(rest).success).toBe(false);
  });

  it.each([
    ["loanId", "x"],
    ["accountId", "x"],
    ["accountId", "550e8400-e29b-41d4-a716-446655440000"],
    ["paidAt", "2026-02-30"],
    ["paidAt", "20/11/2026"],
    ["amountCents", 0],
    ["amountCents", -5],
    ["amountCents", 1.5],
    ["amountCents", "1000"],
    ["method", "TED"],
    ["method", "pix"],
  ])("C30 (A20): rejects %s = %j", (key, value) => {
    expect(createPaymentRequest.safeParse({ ...payment, [key]: value }).success).toBe(false);
  });

  it.each([
    ["destinationKey", "chave-pix@exemplo.com"],
    ["receiptAttachmentId", LOAN],
    ["channel", "ADMIN"],
    ["status", "CONFIRMED"],
    ["isRecovery", true],
  ])("C31 (A13, A20): is strict and refuses the key %s", (key, value) => {
    expect(createPaymentRequest.safeParse({ ...payment, [key]: value }).success).toBe(false);
  });
});

describe("paymentFieldsSchema (the web form uses it, E11-F02)", () => {
  it("C31 (A20): has the same five fields as the request, with accountId instead of destinationKey", () => {
    expect(paymentFieldsSchema.safeParse(payment).success).toBe(true);
    expect(paymentFieldsSchema.safeParse({ ...payment, destinationKey: "chave" }).success).toBe(false);
    const withoutAccount = { loanId: LOAN, paidAt: "2026-11-20", amountCents: 115000, method: "PIX" };
    expect(paymentFieldsSchema.safeParse(withoutAccount).success).toBe(false);
  });
});
