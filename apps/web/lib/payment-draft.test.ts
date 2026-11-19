import { describe, expect, it } from "vitest";
import { MoneyError } from "@pilla/finance";
import { ZodError } from "zod";
import type { PaymentFormValues } from "./payment-draft";
import { toPaymentDraft } from "./payment-draft";

describe("toPaymentDraft", () => {
  const loanId = "01936f8e-7b2c-7cde-8f00-000000000002";
  const example: PaymentFormValues = {
    destinationKey: "chave-pix@exemplo.com",
    paidAt: "2026-12-13",
    amount: "1.150,00",
    method: "PIX",
  };

  it("builds the RFC-004 payment", () => {
    expect(toPaymentDraft(loanId, example)).toStrictEqual({
      loanId: "01936f8e-7b2c-7cde-8f00-000000000002",
      destinationKey: "chave-pix@exemplo.com",
      paidAt: "2026-12-13",
      amountCents: 115000,
      method: "PIX",
    });
  });

  it("accepts the four methods", () => {
    const base = {
      loanId: "01936f8e-7b2c-7cde-8f00-000000000002",
      destinationKey: "chave-pix@exemplo.com",
      paidAt: "2026-12-13",
      amountCents: 115000,
    };

    expect(toPaymentDraft(loanId, { ...example, method: "PIX" })).toStrictEqual({ ...base, method: "PIX" });
    expect(toPaymentDraft(loanId, { ...example, method: "BOLETO" })).toStrictEqual({ ...base, method: "BOLETO" });
    expect(toPaymentDraft(loanId, { ...example, method: "CASH" })).toStrictEqual({ ...base, method: "CASH" });
    expect(toPaymentDraft(loanId, { ...example, method: "BANK_TRANSFER" })).toStrictEqual({
      ...base,
      method: "BANK_TRANSFER",
    });
  });

  it("rejects a bad amount", () => {
    expect(() => toPaymentDraft(loanId, { ...example, amount: "1150" })).toThrow(MoneyError);
    expect(() => toPaymentDraft(loanId, { ...example, amount: "1.150,5" })).toThrow(MoneyError);
    expect(() => toPaymentDraft(loanId, { ...example, amount: "0,00" })).toThrow(ZodError);
    expect(() => toPaymentDraft(loanId, { ...example, amount: "-5,00" })).toThrow(ZodError);
  });

  it("rejects a bad date, account and loan", () => {
    expect(() => toPaymentDraft(loanId, { ...example, paidAt: "2026-02-30" })).toThrow(ZodError);
    expect(() => toPaymentDraft(loanId, { ...example, destinationKey: "" })).toThrow(ZodError);
    expect(() => toPaymentDraft("abc", example)).toThrow(ZodError);
  });

  it("does not limit the date nor the amount", () => {
    expect(toPaymentDraft(loanId, { ...example, paidAt: "2099-01-01" }).paidAt).toBe("2099-01-01");
    expect(toPaymentDraft(loanId, { ...example, paidAt: "2000-01-01" }).paidAt).toBe("2000-01-01");
    expect(toPaymentDraft(loanId, { ...example, amount: "90.000.000,00" }).amountCents).toBe(9000000000);
  });
});
