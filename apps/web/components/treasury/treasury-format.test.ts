import { describe, expect, it } from "vitest";
import { formatBps, formatMoney } from "./treasury-format";

describe("treasury-format", () => {
  it("formata centavos com sinal em reais", () => {
    expect(formatMoney(123456)).toBe("R$ 1.234,56");
    expect(formatMoney(-1000)).toBe("-R$ 10,00");
    expect(formatMoney(0)).toBe("R$ 0,00");
  });

  it("formata pontos-base em percentual e nulo vira traço", () => {
    expect(formatBps(7500)).toBe("75,00%");
    expect(formatBps(1)).toBe("0,01%");
    expect(formatBps(null)).toBe("—");
  });
});
