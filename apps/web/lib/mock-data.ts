import type {
  DefaultTermsResponse,
  LoanDetailResponse,
  LoanInstallment,
  LoanListItem,
  PersonSummary,
} from "@pilla/schemas";

// Dados de mentira das telas do ADMIN enquanto a API não existe (decisões do Joel de 17/11, E7). Valores do
// exemplo da RFC-004 §5 (contrato 2026-0012) e dos padrões do PRD-001 (CA-01, CA-05, RN-C03). Ids fictícios em
// UUID v7; CPFs fictícios com dígitos válidos.

const id = (n: number): string => `01936f8e-7b2c-7cde-8f00-${String(n).padStart(12, "0")}`;

export const mockPeople: readonly PersonSummary[] = [
  { id: id(1), fullName: "Maria da Silva", cpf: "52998224725", phone: "+5511987654321", active: true },
  { id: id(3), fullName: "João Pereira", cpf: "11144477735", phone: "+5511912345678", active: true },
];

/** Padrões do RF-40: multa 2%, mora 1% a.m., carência 0 (CA-05), taxa 6,33% (CA-01), passo R$ 5,00 (RN-C03). */
export const mockDefaultTerms: DefaultTermsResponse = {
  lateFeeBps: 200,
  lateInterestMonthlyBps: 100,
  gracePeriodDays: 0,
  suggestedMonthlyRateBps: 633,
  roundingStepCents: 500,
};

const paid = (number: number, dueDate: string): LoanInstallment => ({
  number,
  dueDate,
  totalCents: 115000,
  paidCents: 115000,
  lateChargesCents: 0,
  status: "PAID",
});
const open = (number: number, dueDate: string): LoanInstallment => ({
  number,
  dueDate,
  totalCents: 115000,
  paidCents: 0,
  lateChargesCents: 0,
  status: "OPEN",
});

/** RFC-004 §5: contrato 2026-0012, 5.000,00 a 6,33% em 6 parcelas de 1.150,00; 2 pagas, saldo 4.600,00. */
export const exampleLoanDetail: LoanDetailResponse = {
  id: id(2),
  loanNumber: "2026-0012",
  personId: id(1),
  personName: "Maria da Silva",
  type: "INSTALLMENT",
  status: "ACTIVE",
  standing: "CURRENT",
  principalCents: 500000,
  monthlyInterestRateBps: 633,
  installmentCount: 6,
  frequency: { unit: "MONTH", interval: 1 },
  firstDueDate: "2026-12-14",
  contractedAt: "2026-11-14",
  disbursedAt: "2026-11-14",
  lateFeeBps: 200,
  lateInterestMonthlyBps: 100,
  gracePeriodDays: 0,
  roundingStepCents: 500,
  totalCents: 690000,
  interestCents: 190000,
  paidCents: 230000,
  outstandingCents: 460000,
  installments: [
    paid(1, "2026-12-14"),
    paid(2, "2027-01-14"),
    open(3, "2027-02-14"),
    open(4, "2027-03-14"),
    open(5, "2027-04-14"),
    open(6, "2027-05-14"),
  ],
};

/** Contrato em rascunho (RF-11): sem desembolso, sem parcelas, sem situação. */
export const draftLoanDetail: LoanDetailResponse = {
  ...exampleLoanDetail,
  id: id(7),
  loanNumber: "2026-0013",
  personId: id(3),
  personName: "João Pereira",
  status: "DRAFT",
  standing: null,
  disbursedAt: null,
  paidCents: 0,
  outstandingCents: 690000,
  installments: [],
};

export const mockLoanDetails: readonly LoanDetailResponse[] = [exampleLoanDetail, draftLoanDetail];

/** Linha da lista do contrato da RFC-004 §5. */
export const exampleLoanListItem: LoanListItem = {
  id: id(2),
  loanNumber: "2026-0012",
  personName: "Maria da Silva",
  principalCents: 500000,
  outstandingCents: 460000,
  status: "ACTIVE",
  standing: "CURRENT",
  nextDueDate: "2027-02-14",
};

/** Contrato quitado: sem situação nem próximo vencimento. */
export const paidOffLoanListItem: LoanListItem = {
  id: id(8),
  loanNumber: "2026-0003",
  personName: "João Pereira",
  principalCents: 200000,
  outstandingCents: 0,
  status: "PAID_OFF",
  standing: null,
  nextDueDate: null,
};

export const mockLoanList: readonly LoanListItem[] = [
  exampleLoanListItem,
  paidOffLoanListItem,
  {
    id: id(7),
    loanNumber: "2026-0013",
    personName: "João Pereira",
    principalCents: 500000,
    outstandingCents: 690000,
    status: "DRAFT",
    standing: null,
    nextDueDate: null,
  },
];
