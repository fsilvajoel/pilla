import type {
  AccountStatementEntry,
  InstallmentStatus,
  LoanStanding,
  LoanStatus,
  PaymentMethod,
  PaymentStatus,
} from "@pilla/schemas";

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

/** Situação do pagamento na fila de conferência. */
export const paymentStatusLabel: Readonly<Record<PaymentStatus, string>> = {
  PENDING_REVIEW: "Aguardando conferência",
  CONFIRMED: "Confirmado",
  REVERSED: "Estornado",
  REJECTED: "Rejeitado",
};

/** Tipo do lançamento do caixa (RFC-005 §6). */
export const ledgerEntryTypeLabel: Readonly<Record<AccountStatementEntry["type"], string>> = {
  CAPITAL_IN: "Aporte",
  CAPITAL_OUT: "Retirada",
  DISBURSEMENT: "Desembolso",
  REPAYMENT: "Pagamento recebido",
  REVERSAL: "Estorno",
  ADJUSTMENT: "Ajuste",
};

/** Componente do lançamento do caixa; sem componente, o extrato mostra "—". */
export const ledgerComponentLabel: Readonly<Record<NonNullable<AccountStatementEntry["component"]>, string>> = {
  PRINCIPAL: "Principal",
  INTEREST: "Juros",
  LATE_CHARGES: "Encargos de atraso",
  RECOVERY: "Recuperação",
};
