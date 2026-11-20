import { describe, expect, it } from "vitest";
import { installmentStatusLabel, loanStandingLabel, loanStatusLabel, paymentMethodLabel } from "./labels";

describe("rótulos", () => {
  it("status do contrato", () => {
    expect(loanStatusLabel).toEqual({
      DRAFT: "Rascunho",
      ACTIVE: "Ativo",
      PAID_OFF: "Quitado",
      RENEWED: "Renovado",
      RENEGOTIATED: "Renegociado",
      WRITTEN_OFF: "Baixado como perda",
      CANCELLED: "Cancelado",
    });
  });
  it("situação do contrato ativo", () => {
    expect(loanStandingLabel).toEqual({ CURRENT: "Em dia", OVERDUE: "Em atraso" });
  });
  it("situação da parcela", () => {
    expect(installmentStatusLabel).toEqual({
      OPEN: "Aberta",
      PARTIAL: "Parcial",
      PAID: "Paga",
      OVERDUE: "Vencida",
      OVERDUE_PARTIAL: "Vencida parcial",
    });
  });
  it("método de pagamento", () => {
    expect(paymentMethodLabel).toEqual({
      PIX: "PIX",
      BOLETO: "Boleto",
      CASH: "Espécie",
      BANK_TRANSFER: "Transferência",
    });
  });
});
