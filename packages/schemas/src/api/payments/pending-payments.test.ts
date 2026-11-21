import { describe, expect, it } from "vitest";
import { pendingPaymentSchema, pendingPaymentsSummarySchema } from "./pending-payments";

const ID = (n: number): string => `01936f8e-7b2c-7cde-8f00-${String(n).padStart(12, "0")}`;

const item = {
  id: ID(1),
  loanId: ID(2),
  personId: ID(3),
  accountId: ID(4),
  paidAt: "2026-11-20",
  amountCents: 115000,
  method: "PIX",
  registeredAt: "2026-11-20T12:00:00-03:00",
};

describe("pendingPaymentSchema (contrato da E13, RF-50)", () => {
  it("C28 (A20): accepts the eight fields of the contract", () => {
    const parsed = pendingPaymentSchema.safeParse(item);
    expect(parsed.success).toBe(true);
    expect(parsed.data).toEqual(item);
  });

  it("C28 (A20): registeredAt also accepts the UTC form", () => {
    expect(pendingPaymentSchema.safeParse({ ...item, registeredAt: "2026-11-20T15:00:00.000Z" }).success).toBe(true);
  });

  it.each(Object.keys(item))("C29 (A20): rejects an item without %s", (key) => {
    const rest = Object.fromEntries(Object.entries(item).filter(([name]) => name !== key));
    expect(pendingPaymentSchema.safeParse(rest).success).toBe(false);
  });

  it.each([
    ["id", "x"],
    ["loanId", "x"],
    ["personId", "x"],
    ["accountId", "x"],
    ["paidAt", "2026-02-30"],
    ["amountCents", 0],
    ["amountCents", 10.5],
    ["method", "TED"],
    ["registeredAt", "2026-11-20T12:00:00"],
    ["registeredAt", "2026-11-20"],
  ])("C30 (A20): rejects %s = %j", (key, value) => {
    expect(pendingPaymentSchema.safeParse({ ...item, [key]: value }).success).toBe(false);
  });

  it("C31 (A20): is strict, so no person name, loan number or recovery flag leaks in", () => {
    expect(pendingPaymentSchema.safeParse({ ...item, personName: "Ana Souza" }).success).toBe(false);
    expect(pendingPaymentSchema.safeParse({ ...item, loanNumber: "2026-0001" }).success).toBe(false);
  });
});

describe("pendingPaymentsSummarySchema (contrato da E13, RF-50)", () => {
  const summary = { count: 3, totalCents: 345000, items: [item] };

  it("C28 (A20): accepts count, totalCents and items; count may exceed the page", () => {
    expect(pendingPaymentsSummarySchema.safeParse(summary).success).toBe(true);
  });

  it("C28 (A20): accepts the empty queue", () => {
    expect(pendingPaymentsSummarySchema.safeParse({ count: 0, totalCents: 0, items: [] }).success).toBe(true);
  });

  it.each(["count", "totalCents", "items"])("C29 (A20): rejects a summary without %s", (key) => {
    const rest = Object.fromEntries(Object.entries(summary).filter(([name]) => name !== key));
    expect(pendingPaymentsSummarySchema.safeParse(rest).success).toBe(false);
  });

  it.each([
    ["count", -1],
    ["count", 1.5],
    ["totalCents", -1],
    ["totalCents", 10.5],
    ["items", [{ ...item, amountCents: 0 }]],
    ["items", "x"],
  ])("C30 (A20): rejects %s = %j", (key, value) => {
    expect(pendingPaymentsSummarySchema.safeParse({ ...summary, [key]: value }).success).toBe(false);
  });

  it("C31 (A20): is strict", () => {
    expect(pendingPaymentsSummarySchema.safeParse({ ...summary, nextCursor: null }).success).toBe(false);
  });
});
