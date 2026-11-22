import { describe, expect, it } from "vitest";
import {
  paymentListItemSchema,
  paymentListQuery,
  paymentListResponse,
  paymentResponse,
  paymentStatusSchema,
} from "./payment-views";

const ID = (n: number): string => `01936f8e-7b2c-7cde-8f00-${String(n).padStart(12, "0")}`;

const item = {
  id: ID(1),
  loanId: ID(2),
  loanNumber: "2026-0001",
  personId: ID(3),
  personName: "Ana Souza",
  accountId: ID(4),
  paidAt: "2026-11-20",
  amountCents: 115000,
  method: "PIX",
  status: "PENDING_REVIEW",
  isRecovery: false,
  version: 1,
  createdAt: "2026-11-20T12:00:00-03:00",
  confirmedAt: null,
  reversedAt: null,
};

const detail = { ...item, version: 1, reversalReason: null, loanStatus: "ACTIVE", allocations: [] };

describe("paymentStatusSchema", () => {
  it.each(["PENDING_REVIEW", "CONFIRMED", "REVERSED"])("C28 (A20): accepts %s", (status) => {
    expect(paymentStatusSchema.safeParse(status).success).toBe(true);
  });

  it.each(["pending", "PAID", ""])("C30 (A20): rejects %j", (status) => {
    expect(paymentStatusSchema.safeParse(status).success).toBe(false);
  });
});

describe("paymentListItemSchema: version", () => {
  it.each([0, -1, 1.5, "1"])("rejects version %j", (version) => {
    expect(paymentListItemSchema.safeParse({ ...item, version }).success).toBe(false);
  });
});

describe("paymentListItemSchema", () => {
  it("C28 (A15): accepts a list item with the loan number and the person name", () => {
    expect(paymentListItemSchema.safeParse(item).success).toBe(true);
  });

  it("C28 (A15): confirmedAt and reversedAt accept instants", () => {
    const done = { ...item, confirmedAt: "2026-11-21T09:00:00-03:00", reversedAt: "2026-11-22T09:00:00-03:00" };
    expect(paymentListItemSchema.safeParse(done).success).toBe(true);
  });

  it.each(Object.keys(item))("C29 (A15): rejects an item without %s", (key) => {
    const rest = Object.fromEntries(Object.entries(item).filter(([name]) => name !== key));
    expect(paymentListItemSchema.safeParse(rest).success).toBe(false);
  });

  it.each([
    ["loanNumber", "26-1"],
    ["personName", ""],
    ["status", "PAID"],
    ["method", "TED"],
    ["amountCents", 0],
    ["createdAt", "2026-11-20T12:00:00"],
    ["confirmedAt", "2026-11-21"],
    ["isRecovery", "no"],
  ])("C30 (A15): rejects %s = %j", (key, value) => {
    expect(paymentListItemSchema.safeParse({ ...item, [key]: value }).success).toBe(false);
  });

  it("C31 (A15): is strict", () => {
    expect(paymentListItemSchema.safeParse({ ...item, receiptAttachmentId: null }).success).toBe(false);
  });
});

describe("paymentResponse", () => {
  it("C28 (A5): accepts the item plus version, reversalReason, loanStatus and no allocation", () => {
    expect(paymentResponse.safeParse(detail).success).toBe(true);
  });

  it("C28 (A5): accepts allocations of a confirmed payment", () => {
    const allocations = [{ installmentNumber: 1, lateChargesCents: 0, interestCents: 20000, principalCents: 95000 }];
    const confirmed = { ...detail, status: "CONFIRMED", confirmedAt: "2026-11-21T09:00:00-03:00", allocations };
    expect(paymentResponse.safeParse(confirmed).success).toBe(true);
  });

  it("C28 (A5): accepts a reversal reason", () => {
    expect(paymentResponse.safeParse({ ...detail, reversalReason: "Valor lançado errado" }).success).toBe(true);
  });

  it.each(["version", "reversalReason", "loanStatus", "allocations"])("C29 (A5): rejects a body without %s", (key) => {
    const rest = Object.fromEntries(Object.entries(detail).filter(([name]) => name !== key));
    expect(paymentResponse.safeParse(rest).success).toBe(false);
  });

  it.each([
    ["version", 0],
    ["loanStatus", "OPEN"],
    ["allocations", [{ installmentNumber: 0, lateChargesCents: 0, interestCents: 0, principalCents: 1 }]],
    ["allocations", [{ installmentNumber: 1, lateChargesCents: -1, interestCents: 0, principalCents: 1 }]],
  ])("C30 (A5): rejects %s = %j", (key, value) => {
    expect(paymentResponse.safeParse({ ...detail, [key]: value }).success).toBe(false);
  });

  it("C31 (A5): is strict, also inside an allocation", () => {
    expect(paymentResponse.safeParse({ ...detail, receiptAttachmentId: null }).success).toBe(false);
    const extra = [{ installmentNumber: 1, lateChargesCents: 0, interestCents: 0, principalCents: 1, dueDate: "x" }];
    expect(paymentResponse.safeParse({ ...detail, allocations: extra }).success).toBe(false);
  });
});

describe("paymentListQuery", () => {
  it("C28 (A15): every filter is optional and the limit defaults to 20", () => {
    expect(paymentListQuery.parse({})).toEqual({ limit: 20 });
  });

  it("C28 (A15): reads status, loanId, cursor and the limit as text from the URL", () => {
    const query = { status: "CONFIRMED", loanId: ID(2), limit: "50", cursor: "abc" };
    expect(paymentListQuery.parse(query)).toEqual({ ...query, limit: 50 });
  });

  it.each([
    { limit: "0" },
    { limit: "101" },
    { limit: "-1" },
    { limit: "1.5" },
    { limit: "abc" },
    { limit: "" },
    { status: "PAID" },
    { loanId: "x" },
    { cursor: "" },
    { owner: "x" },
  ])("C30 (A15): rejects %j", (query) => {
    expect(paymentListQuery.safeParse(query).success).toBe(false);
  });
});

describe("paymentListResponse", () => {
  it("C28 (A15): accepts a page with and without a next cursor", () => {
    expect(paymentListResponse.safeParse({ items: [item], nextCursor: "abc" }).success).toBe(true);
    expect(paymentListResponse.safeParse({ items: [], nextCursor: null }).success).toBe(true);
  });

  it("C29 (A15): rejects a page without nextCursor or items, and an unknown key", () => {
    expect(paymentListResponse.safeParse({ items: [item] }).success).toBe(false);
    expect(paymentListResponse.safeParse({ nextCursor: null }).success).toBe(false);
    expect(paymentListResponse.safeParse({ items: [], nextCursor: null, total: 0 }).success).toBe(false);
  });
});
