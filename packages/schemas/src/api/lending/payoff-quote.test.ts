import { describe, expect, it } from "vitest";
import { payoffQuoteResponse } from "./payoff-quote";

const quote = {
  date: "2026-11-20",
  amountCents: 425000,
  principalCents: 360000,
  interestCents: 60000,
  lateChargesCents: 5000,
};

describe("payoffQuoteResponse (E10-F05, A10)", () => {
  it("C17: accepts the date and the amount with its three components, all integers", () => {
    expect(payoffQuoteResponse.parse(quote)).toEqual(quote);
  });

  it("C17: accepts zero in every component", () => {
    const zero = { ...quote, amountCents: 0, principalCents: 0, interestCents: 0, lateChargesCents: 0 };
    expect(payoffQuoteResponse.safeParse(zero).success).toBe(true);
  });

  it("C18: rejects a fractional or negative amount in any money field", () => {
    expect(payoffQuoteResponse.safeParse({ ...quote, amountCents: 4250.5 }).success).toBe(false);
    expect(payoffQuoteResponse.safeParse({ ...quote, principalCents: -1 }).success).toBe(false);
    expect(payoffQuoteResponse.safeParse({ ...quote, interestCents: 1.5 }).success).toBe(false);
    expect(payoffQuoteResponse.safeParse({ ...quote, lateChargesCents: "5000" }).success).toBe(false);
  });

  it("C18: rejects a missing component, an invalid date and an unknown key", () => {
    const incomplete = {
      date: quote.date,
      amountCents: quote.amountCents,
      principalCents: quote.principalCents,
      interestCents: quote.interestCents,
    };
    expect(payoffQuoteResponse.safeParse(incomplete).success).toBe(false);
    expect(payoffQuoteResponse.safeParse({ ...quote, date: "20/11/2026" }).success).toBe(false);
    expect(payoffQuoteResponse.safeParse({ ...quote, discountCents: 0 }).success).toBe(false);
  });
});
