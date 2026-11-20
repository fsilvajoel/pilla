import { describe, expect, it } from "vitest";
import { formatCpf, formatPhone } from "./format";

describe("formatCpf", () => {
  it("formats 11 digits", () => {
    expect(formatCpf("52998224725")).toBe("529.982.247-25");
  });

  it("accepts an already formatted CPF", () => {
    expect(formatCpf("529.982.247-25")).toBe("529.982.247-25");
  });

  it("shows a dash for a missing CPF", () => {
    expect(formatCpf(null)).toBe("—");
  });

  it("returns the original value when it does not have 11 digits", () => {
    expect(formatCpf("123")).toBe("123");
  });
});

describe("formatPhone", () => {
  it("formats a mobile number and drops the +55 country code", () => {
    expect(formatPhone("+5511987654321")).toBe("(11) 98765-4321");
    expect(formatPhone("11987654321")).toBe("(11) 98765-4321");
  });

  it("formats a landline number", () => {
    expect(formatPhone("1133334444")).toBe("(11) 3333-4444");
  });

  it("returns the original value for any other length", () => {
    expect(formatPhone("12345")).toBe("12345");
  });
});
