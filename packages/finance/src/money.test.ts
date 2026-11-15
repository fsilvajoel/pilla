import { describe, expect, it } from "vitest";
import { bps, cents, formatReais, MoneyError, parseReais } from "./money";

describe("money (ADR-0004)", () => {
  it("cents brands a bigint without changing it", () => {
    expect(cents(115000n)).toBe(115000n);
  });

  it("bps brands a rate and rejects negative rates", () => {
    expect(bps(633n)).toBe(633n);
    expect(() => bps(-1n)).toThrow(MoneyError);
  });

  it.each([
    ["1.234,56", 123456n],
    ["0,05", 5n],
    ["5.000,00", 500000n],
    ["5000,00", 500000n],
    ["-1.150,00", -115000n],
  ])("parseReais(%s) = %s", (text, expected) => {
    expect(parseReais(text)).toBe(expected);
  });

  it.each(["1.234,5", "abc", "1,234.56", "12.34,00", ""])("parseReais rejects %s", (text) => {
    expect(() => parseReais(text)).toThrow(MoneyError);
  });

  it.each([
    [123456n, "1.234,56"],
    [5n, "0,05"],
    [115000n, "1.150,00"],
    [-115000n, "-1.150,00"],
    [123456789n, "1.234.567,89"],
  ])("formatReais(%s) = %s", (value, expected) => {
    expect(formatReais(cents(value))).toBe(expected);
  });

  it("parse and format round-trip", () => {
    expect(formatReais(parseReais("6.900,00"))).toBe("6.900,00");
  });
});
