import { describe, expect, it } from "vitest";
import { rolloverPreview } from "./rollover-preview";

const quote = {
  date: "2026-11-20",
  amountCents: 425000,
  principalCents: 360000,
  interestCents: 60000,
  lateChargesCents: 5000,
};

describe("rolloverPreview", () => {
  it("renewal carries only the open principal", () => {
    expect(rolloverPreview("RENEWAL", quote)).toEqual({ newPrincipalCents: 360000, capitalizedCents: 0 });
  });

  it("renegotiation carries the whole balance and capitalizes interest and charges", () => {
    expect(rolloverPreview("RENEGOTIATION", quote)).toEqual({ newPrincipalCents: 425000, capitalizedCents: 65000 });
  });
});
