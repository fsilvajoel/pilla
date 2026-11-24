import { describe, expect, it } from "vitest";
import { formatDate, formatReais, stripCpfPunctuation } from "./portal-format";

describe("portal-format", () => {
  it("formata centavos em reais com vírgula", () => {
    expect(formatReais(114983)).toBe("R$ 1.149,83");
    expect(formatReais(0)).toBe("R$ 0,00");
    expect(formatReais(500000)).toBe("R$ 5.000,00");
  });

  it("formata data ISO em dd/mm/aaaa", () => {
    expect(formatDate("2026-12-15")).toBe("15/12/2026");
    expect(formatDate("lixo")).toBe("lixo");
  });

  it("tira a pontuação do CPF colado", () => {
    expect(stripCpfPunctuation("529.982.247-25")).toBe("52998224725");
    expect(stripCpfPunctuation(" 52998224725 ")).toBe("52998224725");
  });
});
