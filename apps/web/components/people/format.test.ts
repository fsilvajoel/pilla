import { describe, expect, it } from "vitest";
import { formatCpf, formatPhone, formatPortalAccessDate } from "./format";

describe("formatCpf", () => {
  it("formata 11 dígitos", () => {
    expect(formatCpf("52998224725")).toBe("529.982.247-25");
  });
  it("aceita CPF já mascarado", () => {
    expect(formatCpf("529.982.247-25")).toBe("529.982.247-25");
  });
  it("nulo vira traço", () => {
    expect(formatCpf(null)).toBe("—");
  });
  it("sem 11 dígitos devolve o original", () => {
    expect(formatCpf("123")).toBe("123");
    expect(formatCpf("")).toBe("");
  });
});

describe("formatPhone", () => {
  it("celular de 11 dígitos", () => {
    expect(formatPhone("11987654321")).toBe("(11) 98765-4321");
  });
  it("fixo de 10 dígitos", () => {
    expect(formatPhone("1134567890")).toBe("(11) 3456-7890");
  });
  it("ignora máscara existente", () => {
    expect(formatPhone("(11) 98765-4321")).toBe("(11) 98765-4321");
  });
  it("inválido devolve o original", () => {
    expect(formatPhone("+5511987654321")).toBe("+5511987654321");
    expect(formatPhone("123")).toBe("123");
  });
});

describe("formatPortalAccessDate", () => {
  it("usa a data civil de Brasília (UTC-3)", () => {
    expect(formatPortalAccessDate("2026-11-20T15:30:00Z")).toBe("20/11/2026");
    expect(formatPortalAccessDate("2026-11-21T02:00:00Z")).toBe("20/11/2026");
  });
  it("data inválida volta sem mudança", () => {
    expect(formatPortalAccessDate("ontem")).toBe("ontem");
  });
});
