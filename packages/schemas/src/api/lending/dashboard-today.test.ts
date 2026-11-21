import { describe, expect, it } from "vitest";
import { dashboardTodayResponse } from "./dashboard-today";

const loanId = "0190f3a2-7b1c-7d4e-8a5b-1c2d3e4f5a6b";
const personId = "0190f3a2-7b1c-7d4e-8a5b-1c2d3e4f5a6c";
const paymentId = "0190f3a2-7b1c-7d4e-8a5b-1c2d3e4f5a6d";

const dueItem = {
  loanId,
  loanNumber: "2026-0012",
  personId,
  personName: "Maria Souza",
  installmentNumber: 2,
  dueDate: "2026-11-21",
  openCents: 50000,
  status: "OPEN",
};
const overdueItem = {
  loanId,
  loanNumber: "2026-0012",
  personId,
  personName: "Maria Souza",
  installmentNumber: 1,
  dueDate: "2026-11-18",
  openCents: 50000,
  daysOverdue: 3,
  lateChargesCents: 1500,
  totalDueCents: 51500,
  status: "OVERDUE",
};
const pendingItem = {
  paymentId,
  loanId,
  loanNumber: "2026-0012",
  personName: "Maria Souza",
  loanStatus: "ACTIVE",
  amountCents: 50000,
  paidAt: "2026-11-20",
  method: "PIX",
  createdAt: "2026-11-20T15:30:00-03:00",
};
/** Cópia do objeto sem a chave dada. */
function without(source: object, key: string): Record<string, unknown> {
  return Object.fromEntries(Object.entries(source).filter(([name]) => name !== key));
}

const empty = { count: 0, totalCents: 0, items: [] };
const response = {
  referenceDate: "2026-11-21",
  weekEndDate: "2026-11-28",
  dueToday: { count: 1, totalCents: 50000, items: [dueItem] },
  dueThisWeek: { count: 1, totalCents: 50000, items: [{ ...dueItem, dueDate: "2026-11-25", status: "PARTIAL" }] },
  overdue: { count: 1, totalCents: 51500, items: [overdueItem] },
  pendingReview: { count: 1, totalCents: 50000, items: [pendingItem] },
};

describe("dashboardTodayResponse shape (E13-F02A, A10)", () => {
  it("C17: accepts the dates and the four blocks, each {count, totalCents, items}", () => {
    expect(dashboardTodayResponse.parse(response)).toEqual(response);
  });

  it("C18: rejects a response missing any of the four blocks or a date", () => {
    for (const key of ["dueToday", "dueThisWeek", "overdue", "pendingReview", "referenceDate", "weekEndDate"]) {
      const rest = without(response, key);
      expect(dashboardTodayResponse.safeParse(rest).success, key).toBe(false);
    }
  });

  it("C19: rejects a block without count, totalCents or items", () => {
    for (const key of ["count", "totalCents", "items"]) {
      const block = without(response.dueToday, key);
      expect(dashboardTodayResponse.safeParse({ ...response, dueToday: block }).success, key).toBe(false);
    }
  });

  it("C20: rejects negative counts and totals and a negative or fractional amount in any money field", () => {
    const withBlock = (patch: object) => ({ ...response, dueToday: { ...response.dueToday, ...patch } });
    expect(dashboardTodayResponse.safeParse(withBlock({ count: -1 })).success).toBe(false);
    expect(dashboardTodayResponse.safeParse(withBlock({ totalCents: -1 })).success).toBe(false);
    expect(dashboardTodayResponse.safeParse(withBlock({ totalCents: 10.5 })).success).toBe(false);
    expect(dashboardTodayResponse.safeParse(withBlock({ items: [{ ...dueItem, openCents: -1 }] })).success).toBe(false);
  });
});

describe("dashboardTodayResponse items (E13-F02A, A11)", () => {
  const withOverdue = (item: object) => ({ ...response, overdue: { ...response.overdue, items: [item] } });
  const withDue = (item: object) => ({ ...response, dueToday: { ...response.dueToday, items: [item] } });
  const withPending = (item: object) => ({ ...response, pendingReview: { ...response.pendingReview, items: [item] } });

  it("C21: an overdue item requires daysOverdue >= 1, lateChargesCents and totalDueCents", () => {
    expect(dashboardTodayResponse.safeParse(withOverdue({ ...overdueItem, daysOverdue: 0 })).success).toBe(false);
    for (const key of ["daysOverdue", "lateChargesCents", "totalDueCents"]) {
      const item = without(overdueItem, key);
      expect(dashboardTodayResponse.safeParse(withOverdue(item)).success, key).toBe(false);
    }
  });

  it("C22: an overdue item accepts OVERDUE_PARTIAL and rejects the due-only statuses", () => {
    expect(dashboardTodayResponse.safeParse(withOverdue({ ...overdueItem, status: "OVERDUE_PARTIAL" })).success).toBe(
      true,
    );
    expect(dashboardTodayResponse.safeParse(withOverdue({ ...overdueItem, status: "OPEN" })).success).toBe(false);
    expect(dashboardTodayResponse.safeParse(withOverdue({ ...overdueItem, status: "PAID" })).success).toBe(false);
  });

  it("C23: a due item has no daysOverdue and only OPEN or PARTIAL status", () => {
    expect(dashboardTodayResponse.safeParse(withDue({ ...dueItem, daysOverdue: 1 })).success).toBe(false);
    expect(dashboardTodayResponse.safeParse(withDue({ ...dueItem, status: "PARTIAL" })).success).toBe(true);
    expect(dashboardTodayResponse.safeParse(withDue({ ...dueItem, status: "OVERDUE" })).success).toBe(false);
    expect(dashboardTodayResponse.safeParse(withDue({ ...dueItem, installmentNumber: 0 })).success).toBe(false);
  });

  it("C24: a pending item requires every field and amountCents > 0", () => {
    for (const key of Object.keys(pendingItem)) {
      const item = without(pendingItem, key);
      expect(dashboardTodayResponse.safeParse(withPending(item)).success, key).toBe(false);
    }
    expect(dashboardTodayResponse.safeParse(withPending({ ...pendingItem, amountCents: 0 })).success).toBe(false);
    expect(dashboardTodayResponse.safeParse(withPending({ ...pendingItem, method: "CHEQUE" })).success).toBe(false);
  });
});

describe("dashboardTodayResponse strictness (E13-F02A, A12)", () => {
  it("C25: rejects unknown keys at the root, in a block and in an item", () => {
    expect(dashboardTodayResponse.safeParse({ ...response, extra: 1 }).success).toBe(false);
    expect(
      dashboardTodayResponse.safeParse({ ...response, dueToday: { ...response.dueToday, extra: 1 } }).success,
    ).toBe(false);
    const item = { ...dueItem, extra: 1 };
    expect(
      dashboardTodayResponse.safeParse({ ...response, dueToday: { ...response.dueToday, items: [item] } }).success,
    ).toBe(false);
  });

  it("C26: rejects a float in the cents of an overdue and of a pending item", () => {
    const overdue = { ...response.overdue, items: [{ ...overdueItem, lateChargesCents: 15.5 }] };
    expect(dashboardTodayResponse.safeParse({ ...response, overdue }).success).toBe(false);
    const pending = { ...response.pendingReview, items: [{ ...pendingItem, amountCents: 500.5 }] };
    expect(dashboardTodayResponse.safeParse({ ...response, pendingReview: pending }).success).toBe(false);
  });

  it("C26: accepts the empty pendingReview {count 0, totalCents 0, items []} of the F02A", () => {
    const parsed = dashboardTodayResponse.parse({ ...response, pendingReview: empty });
    expect(parsed.pendingReview).toEqual(empty);
  });

  it("C26: accepts a response with four empty blocks", () => {
    const blank = { ...response, dueToday: empty, dueThisWeek: empty, overdue: empty, pendingReview: empty };
    expect(dashboardTodayResponse.safeParse(blank).success).toBe(true);
  });
});
