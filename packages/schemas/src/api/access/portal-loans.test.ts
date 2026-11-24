import { describe, expect, it } from "vitest";
import { portalLoanDetailResponse, portalLoanListResponse } from "./portal-loans";

const ID = "0190f3a2-7b1c-7d4e-8a5b-1c2d3e4f5a6b";

const installment = {
  number: 1,
  dueDate: "2026-12-14",
  amountCents: 115000,
  paidCents: 115000,
  lateChargesCents: 0,
  status: "PAID",
};
const payment = { paidAt: "2026-12-13", amountCents: 115000, method: "PIX" };
// RFC-004 §5: contrato 2026-0012, saldo 4.600,00, completado com id, situation e lateChargesCents.
const detail = {
  id: ID,
  loanNumber: "2026-0012",
  situation: "CURRENT",
  principalCents: 500000,
  totalCents: 575000,
  paidCents: 115000,
  outstandingCents: 460000,
  lateChargesCents: 0,
  nextInstallment: { number: 2, dueDate: "2027-01-14", amountCents: 115000 },
  installments: [installment, { ...installment, number: 2, dueDate: "2027-01-14", paidCents: 0, status: "OPEN" }],
  payments: [payment],
};
const listItem = {
  id: ID,
  loanNumber: "2026-0012",
  principalCents: 500000,
  outstandingCents: 460000,
  situation: "CURRENT",
  nextDueDate: "2027-01-14",
};

const LEAKS = [
  "personId",
  "personName",
  "cpf",
  "internalNotes",
  "monthlyInterestRateBps",
  "lateFeeBps",
  "accountId",
  "paymentId",
  "pixEndToEndId",
  "receipt",
  "originType",
];

describe("portalLoanDetailResponse", () => {
  it("A2: accepts the RFC-004 example completed", () => {
    expect(portalLoanDetailResponse.safeParse(detail).success).toBe(true);
  });

  it("A2: accepts nextInstallment null", () => {
    const paidOff = { ...detail, situation: "PAID_OFF", nextInstallment: null };
    expect(portalLoanDetailResponse.safeParse(paidOff).success).toBe(true);
  });

  it.each([
    ["a decimal value", { ...detail, paidCents: 10.5 }],
    ["a negative value", { ...detail, outstandingCents: -1 }],
    ["an unknown situation", { ...detail, situation: "ACTIVE" }],
    ["an unknown method", { ...detail, payments: [{ ...payment, method: "CARD" }] }],
    ["a bad installment status", { ...detail, installments: [{ ...installment, status: "LATE" }] }],
  ])("A2/A4: rejects %s", (_name, body) => {
    expect(portalLoanDetailResponse.safeParse(body).success).toBe(false);
  });

  it.each(["CURRENT", "OVERDUE", "PAID_OFF"])("A4: accepts situation %s", (situation) => {
    expect(portalLoanDetailResponse.safeParse({ ...detail, situation }).success).toBe(true);
  });

  it.each(["PIX", "BOLETO", "CASH", "BANK_TRANSFER"])("A4: accepts method %s", (method) => {
    expect(portalLoanDetailResponse.safeParse({ ...detail, payments: [{ ...payment, method }] }).success).toBe(true);
  });

  it.each(LEAKS)("A3: rejects the extra key %s at every level", (key) => {
    const extra = { [key]: "x" };
    expect(portalLoanDetailResponse.safeParse({ ...detail, ...extra }).success).toBe(false);
    expect(
      portalLoanDetailResponse.safeParse({ ...detail, installments: [{ ...installment, ...extra }] }).success,
    ).toBe(false);
    expect(portalLoanDetailResponse.safeParse({ ...detail, payments: [{ ...payment, ...extra }] }).success).toBe(false);
    expect(
      portalLoanDetailResponse.safeParse({ ...detail, nextInstallment: { ...detail.nextInstallment, ...extra } })
        .success,
    ).toBe(false);
  });
});

describe("portalLoanListResponse", () => {
  it("A2: accepts an empty items array", () => {
    expect(portalLoanListResponse.safeParse({ items: [] }).success).toBe(true);
  });

  it("A1: accepts an item with and without nextDueDate", () => {
    const list = { items: [listItem, { ...listItem, situation: "PAID_OFF", nextDueDate: null }] };
    expect(portalLoanListResponse.safeParse(list).success).toBe(true);
  });

  it("A4: rejects an unknown situation", () => {
    expect(portalLoanListResponse.safeParse({ items: [{ ...listItem, situation: "ACTIVE" }] }).success).toBe(false);
  });

  it.each(LEAKS)("A3: rejects the extra key %s in the item and at the top", (key) => {
    const extra = { [key]: "x" };
    expect(portalLoanListResponse.safeParse({ items: [{ ...listItem, ...extra }] }).success).toBe(false);
    expect(portalLoanListResponse.safeParse({ items: [], ...extra }).success).toBe(false);
  });
});
