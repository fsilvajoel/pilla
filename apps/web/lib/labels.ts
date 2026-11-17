import type { InstallmentStatus, LoanStanding, LoanStatus, PaymentMethod } from "@pilla/schemas";

// Rótulos das telas, os mesmos do glossário (docs/glossario.md).

/** Status do contrato. */
export const loanStatusLabel: Readonly<Record<LoanStatus, string>> = {
  DRAFT: "Rascunho",
  ACTIVE: "Ativo",
  PAID_OFF: "Quitado",
  RENEWED: "Renovado",
  RENEGOTIATED: "Renegociado",
  WRITTEN_OFF: "Baixado como perda",
  CANCELLED: "Cancelado",
};

/** Situação de um contrato ACTIVE. */
export const loanStandingLabel: Readonly<Record<LoanStanding, string>> = {
  CURRENT: "Em dia",
  OVERDUE: "Em atraso",
};

/** Situação da parcela. */
export const installmentStatusLabel: Readonly<Record<InstallmentStatus, string>> = {
  OPEN: "Aberta",
  PARTIAL: "Parcial",
  PAID: "Paga",
  OVERDUE: "Vencida",
  OVERDUE_PARTIAL: "Vencida parcial",
};

/** Método de pagamento. */
export const paymentMethodLabel: Readonly<Record<PaymentMethod, string>> = {
  PIX: "PIX",
  BOLETO: "Boleto",
  CASH: "Espécie",
  BANK_TRANSFER: "Transferência",
};
