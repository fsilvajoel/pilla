import { describe, expect, it } from "vitest";
import { allocationPreviewResponse } from "./allocation-preview";

const LOAN = "01936f8e-7b2c-7cde-8f00-000000000011";

const preview = {
  loanId: LOAN,
  loanStatus: "ACTIVE",
  paidAt: "2026-11-20",
  amountCents: 150000,
  deferred: false,
  isRecovery: false,
  allocations: [
    {
      installmentNumber: 1,
      dueDate: "2026-09-20",
      lateChargesCents: 6000,
      interestCents: 20000,
      principalCents: 100000,
      installmentStatusAfter: "PAID",
    },
    {
      installmentNumber: 2,
      dueDate: "2026-10-20",
      lateChargesCents: 4500,
      interestCents: 19500,
      principalCents: 0,
      installmentStatusAfter: "PARTIAL",
    },
  ],
  totals: { lateChargesCents: 10500, interestCents: 39500, principalCents: 100000 },
  outstandingBeforeCents: 613500,
  outstandingAfterCents: 463500,
  paysOff: false,
};

const deferred = {
  ...preview,
  loanStatus: "DRAFT",
  deferred: true,
  allocations: [],
  totals: { lateChargesCents: 0, interestCents: 0, principalCents: 0 },
  outstandingBeforeCents: null,
  outstandingAfterCents: null,
};

describe("allocationPreviewResponse (E11-F01, A12 to A14)", () => {
  it("C17 (A14): accepts the allocations, the totals and the balances, all integers", () => {
    expect(allocationPreviewResponse.parse(preview)).toEqual(preview);
  });

  it("C17 (A12): accepts a deferred preview with empty allocations and null balances", () => {
    expect(allocationPreviewResponse.parse(deferred)).toEqual(deferred);
  });

  it("C17 (A13): accepts a recovery preview on a written-off loan", () => {
    const recovery = { ...preview, loanStatus: "WRITTEN_OFF", isRecovery: true };
    expect(allocationPreviewResponse.safeParse(recovery).success).toBe(true);
  });

  it("C18 (A14): rejects a fractional, negative or text amount in any money field", () => {
    expect(allocationPreviewResponse.safeParse({ ...preview, amountCents: 1500.5 }).success).toBe(false);
    expect(allocationPreviewResponse.safeParse({ ...preview, outstandingAfterCents: -1 }).success).toBe(false);
    expect(allocationPreviewResponse.safeParse({ ...preview, outstandingBeforeCents: "613500" }).success).toBe(false);
    const fractional = { ...preview.allocations[0], interestCents: 200.5 };
    const withFraction = { ...preview, allocations: [fractional, preview.allocations[1]] };
    expect(allocationPreviewResponse.safeParse(withFraction).success).toBe(false);
  });

  it("C18 (A14): rejects totals that do not add up to amountCents", () => {
    const short = { ...preview, totals: { ...preview.totals, principalCents: 99999 } };
    const over = { ...preview, totals: { ...preview.totals, lateChargesCents: 10501 } };
    expect(allocationPreviewResponse.safeParse(short).success).toBe(false);
    expect(allocationPreviewResponse.safeParse(over).success).toBe(false);
  });

  it("C18 (A4): rejects allocations that do not add up to the totals", () => {
    const first = { ...preview.allocations[0], principalCents: 99000 };
    const broken = { ...preview, allocations: [first, preview.allocations[1]] };
    expect(allocationPreviewResponse.safeParse(broken).success).toBe(false);
  });

  it("C18: rejects an unknown installment status, a missing field and an unknown key", () => {
    const status = { ...preview.allocations[0], installmentStatusAfter: "OPEN" };
    expect(
      allocationPreviewResponse.safeParse({ ...preview, allocations: [status, preview.allocations[1]] }).success,
    ).toBe(false);
    const incomplete: Record<string, unknown> = { ...preview };
    delete incomplete.paysOff;
    expect(allocationPreviewResponse.safeParse(incomplete).success).toBe(false);
    expect(allocationPreviewResponse.safeParse({ ...preview, discountCents: 0 }).success).toBe(false);
  });
});
