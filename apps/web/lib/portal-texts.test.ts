import { describe, expect, it } from "vitest";
import { portalTexts } from "./portal-texts";

describe("portalTexts", () => {
  it("monta as frases com valor", () => {
    expect(portalTexts.list.contract("L-0001")).toBe("Contrato L-0001");
    expect(portalTexts.list.borrowed("R$ 10,00")).toBe("Emprestado: R$ 10,00");
    expect(portalTexts.list.outstanding("R$ 5,00")).toBe("Falta pagar: R$ 5,00");
    expect(portalTexts.list.nextDue("20/11/2026")).toBe("Próxima parcela em 20/11/2026");
    expect(portalTexts.detail.nextInstallment("R$ 5,00", "20/11/2026")).toBe("Próxima parcela: R$ 5,00 em 20/11/2026.");
    expect(portalTexts.detail.lateCharges("R$ 1,00")).toContain("R$ 1,00");
  });

  it("cobre todas as situações e formas de pagamento do schema", () => {
    expect(Object.keys(portalTexts.situation).sort()).toEqual(["CURRENT", "OVERDUE", "PAID_OFF"]);
    expect(Object.keys(portalTexts.detail.method).sort()).toEqual(["BANK_TRANSFER", "BOLETO", "CASH", "PIX"]);
    expect(Object.keys(portalTexts.detail.installmentStatus)).toHaveLength(5);
  });
});
