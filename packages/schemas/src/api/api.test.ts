import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { cpfSchema, loanNumberSchema, phoneSchema } from "../common";
import { adminLoginRequest } from "./access/admin-login";
import { adminMeResponse } from "./access/admin-me";
import { portalAccessRequest, portalAccessResponse, setPortalAccessRequest } from "./access/portal-access";
import { portalLoanDetailResponse, portalLoanListResponse } from "./access/portal-loans";
import { createPortalSessionRequest, portalSessionRequest } from "./access/portal-session";
import { attachmentUploadUrlRequest } from "./core/attachment-upload-url";
import { activateLoanRequest } from "./lending/activate-loan";
import { createLoanRequest, defaultTermsResponse } from "./lending/create-loan";
import { loanDetailResponse, loanListResponse } from "./lending/loan-views";
import { renegotiateLoanRequest } from "./lending/renegotiate-loan";
import { renewLoanRequest } from "./lending/renew-loan";
import { dashboardTodayResponse } from "./lending/dashboard-today";
import { payoffQuoteQuery, payoffQuoteResponse } from "./lending/payoff-quote";
import { simulateLoanRequest, simulateLoanResponse } from "./lending/simulate-loan";
import { updateDefaultTermsRequest } from "./lending/update-default-terms";
import { updateLoanRequest } from "./lending/update-loan";
import { writeOffLoanRequest } from "./lending/write-off-loan";
import { allocationPreviewRequest, allocationPreviewResponse } from "./payments/allocation-preview";
import { createPaymentRequest } from "./payments/create-payment";
import { paymentListQuery, paymentListResponse, paymentResponse } from "./payments/payment-views";
import { rejectPaymentRequest } from "./payments/reject-payment";
import { reversePaymentRequest } from "./payments/reverse-payment";
import { createPersonRequest, personListResponse } from "./people/create-person";
import { addressSchema, createAddressRequest, updateAddressRequest } from "./people/address";
import { personListQuery } from "./people/person-list-query";
import { personDetailResponse } from "./people/person-detail";
import { createPixKeyRequest, pixKeySchema, updatePixKeyRequest } from "./people/pix-key";
import { personResponse } from "./people/person-response";
import { updatePersonRequest } from "./people/update-person";
import { importReportResponse } from "./imports/import-report";
import { problemSchema } from "./problem";
import { accountEntryRequest, accountEntryResponse } from "./treasury/account-entry";
import { accountStatementQuery, accountStatementResponse } from "./treasury/account-statement";
import { accountListResponse } from "./treasury/account-summary";
import { treasurySummaryQuery, treasurySummaryResponse } from "./treasury/treasury-summary";

// RFC-004 §3–§6. Ids fictícios em UUID v7; CPFs fictícios com dígitos válidos.
const id = (n: number): string => `01936f8e-7b2c-7cde-8f00-${String(n).padStart(12, "0")}`;
const uuidV4 = "550e8400-e29b-41d4-a716-446655440000";
const simulation = {
  type: "INSTALLMENT",
  principalCents: 500000,
  monthlyInterestRateBps: 633,
  installmentCount: 6,
  frequency: { unit: "MONTH", interval: 1 },
  firstDueDate: "2026-12-14",
};
const line = { number: 1, dueDate: "2026-12-14", principalCents: 83333, interestCents: 31667, totalCents: 115000 };
// RN-C12 e CA-05: multa 2%, mora 1% a.m., carência 0 (decisões do Joel de 17/11).
const charges = { lateFeeBps: 200, lateInterestMonthlyBps: 100, gracePeriodDays: 0 };
const loan = { personId: id(1), ...simulation, ...charges };
const person = { id: id(1), fullName: "Maria da Silva", cpf: "52998224725", phone: "+5511987654321", active: true };
const address = {
  street: "Rua das Flores",
  number: "120",
  district: "Centro",
  city: "São Paulo",
  state: "SP",
  postalCode: "01001000",
};
const addressInvalid = {
  street: " ",
  number: "",
  complement: " ",
  district: "",
  city: "",
  state: "sp",
  postalCode: "01001-000",
  isPrimary: "yes",
};
const pixKey = { type: "EMAIL", value: "maria@example.com" };
const pixKeyInvalid = { type: "ALEATORIA", value: " ", isPrimary: "yes" };
// RFC-004 §5 (portal): contrato 2026-0012, 2 parcelas pagas, saldo 4.600,00.
const listItem = {
  id: id(2),
  loanNumber: "2026-0012",
  personName: "Maria da Silva",
  principalCents: 500000,
  outstandingCents: 460000,
  status: "ACTIVE",
  standing: "CURRENT",
  nextDueDate: "2027-02-14",
};
const installment = {
  number: 1,
  dueDate: "2026-12-14",
  totalCents: 115000,
  paidCents: 115000,
  lateChargesCents: 0,
  status: "PAID",
};
const payment = {
  loanId: id(2),
  accountId: id(3),
  paidAt: "2026-12-13",
  amountCents: 115000,
  method: "PIX",
};

interface BodyCase {
  /** nome do esquema exportado (filtro do vitest -t) */
  readonly name: string;
  readonly schema: z.ZodType;
  /** corpo válido mínimo (só obrigatórios) */
  readonly body: Record<string, unknown>;
  /** campos opcionais válidos: o corpo também passa com eles */
  readonly optional?: Record<string, unknown>;
  /** um valor inválido por campo (cada um deve ser recusado) */
  readonly invalid: Record<string, unknown>;
}

const cases: BodyCase[] = [
  {
    name: "simulateLoanRequest",
    schema: simulateLoanRequest,
    body: simulation,
    invalid: {
      type: "BULLET",
      principalCents: 0,
      monthlyInterestRateBps: 6.33,
      installmentCount: 0,
      frequency: { unit: "YEAR", interval: 1 },
      firstDueDate: "2026-12-32",
    },
  },
  {
    name: "simulateLoanResponse",
    schema: simulateLoanResponse,
    body: {
      interestCents: 190000,
      totalCents: 690000,
      installmentAmountCents: 115000,
      periodRateBps: 633,
      schedule: [line],
    },
    invalid: { interestCents: -1, totalCents: "690000", periodRateBps: 1.5, schedule: [] },
  },
  {
    name: "problemSchema",
    schema: problemSchema,
    body: {
      title: "Contrato não editável",
      status: 422,
      detail: "Só contratos em rascunho podem ser editados.",
      code: "LOAN_NOT_EDITABLE",
    },
    optional: { type: "about:blank", instance: "/api/v1/loans/x" },
    invalid: { title: "", status: 400, detail: "", code: "OOPS" },
  },
  {
    name: "adminLoginRequest",
    schema: adminLoginRequest,
    body: { username: "admin", password: "uma senha longa" },
    invalid: { username: "   ", password: "" },
  },
  {
    name: "adminMeResponse",
    schema: adminMeResponse,
    body: { id: "01936f8e-7b2c-7cde-8f00-000000000001", username: "admin", role: "ADMIN" },
    invalid: { id: "x", username: "", role: "CLIENT" },
  },
  {
    name: "portalAccessRequest",
    schema: portalAccessRequest,
    body: { enabled: true },
    invalid: { enabled: "yes" },
  },
  {
    name: "portalSessionRequest",
    schema: portalSessionRequest,
    body: { cpf: "52998224725" },
    invalid: { cpf: "529.982.247-25" },
  },
  {
    name: "setPortalAccessRequest",
    schema: setPortalAccessRequest,
    body: { enabled: false },
    invalid: { enabled: "no" },
  },
  {
    name: "portalAccessResponse",
    schema: portalAccessResponse,
    body: { personId: id(1), enabled: false, enabledAt: null },
    invalid: { personId: "x", enabled: "no", enabledAt: "ontem" },
  },
  {
    name: "createPortalSessionRequest",
    schema: createPortalSessionRequest,
    body: { cpf: "52998224725" },
    invalid: { cpf: "529.982.247-25" },
  },
  {
    name: "portalLoanListResponse",
    schema: portalLoanListResponse,
    body: { items: [] },
    invalid: { items: "nenhum" },
  },
  {
    name: "portalLoanDetailResponse",
    schema: portalLoanDetailResponse,
    body: {
      id: id(2),
      loanNumber: "2026-0012",
      situation: "PAID_OFF",
      principalCents: 500000,
      totalCents: 575000,
      paidCents: 575000,
      outstandingCents: 0,
      lateChargesCents: 0,
      nextInstallment: null,
      installments: [],
      payments: [],
    },
    invalid: { id: "x", loanNumber: "12", situation: "LATE", principalCents: -1, installments: "nenhuma" },
  },
  {
    name: "activateLoanRequest",
    schema: activateLoanRequest,
    body: { disbursedAt: "2027-01-01", accountId: id(4) },
    invalid: { disbursedAt: "2027-02-30", accountId: uuidV4 },
  },
  {
    name: "writeOffLoanRequest",
    schema: writeOffLoanRequest,
    body: { reason: "cliente sem contato há 6 meses" },
    invalid: { reason: "   " },
  },
  {
    name: "renewLoanRequest",
    schema: renewLoanRequest,
    body: { firstDueDate: "2027-01-15" },
    optional: { monthlyInterestRateBps: 500, installmentCount: 4, frequency: { unit: "MONTH", interval: 1 } },
    invalid: { firstDueDate: "2027-02-30", monthlyInterestRateBps: -1, installmentCount: 0 },
  },
  {
    name: "renegotiateLoanRequest",
    schema: renegotiateLoanRequest,
    body: { firstDueDate: "2027-01-15" },
    optional: { monthlyInterestRateBps: 500, installmentCount: 4, frequency: { unit: "MONTH", interval: 1 } },
    invalid: { firstDueDate: "2027-02-30", monthlyInterestRateBps: -1, installmentCount: 0 },
  },
  {
    name: "payoffQuoteQuery",
    schema: payoffQuoteQuery,
    body: { date: "2027-03-01" },
    invalid: { date: "01/03/2027" },
  },
  {
    name: "payoffQuoteResponse",
    schema: payoffQuoteResponse,
    body: {
      date: "2027-03-01",
      amountCents: 432000,
      principalCents: 360000,
      interestCents: 60000,
      lateChargesCents: 12000,
    },
    invalid: {
      date: "01/03/2027",
      amountCents: 4320.5,
      principalCents: -1,
      interestCents: "60000",
      lateChargesCents: null,
    },
  },
  {
    name: "dashboardTodayResponse",
    schema: dashboardTodayResponse,
    body: {
      referenceDate: "2027-03-01",
      weekEndDate: "2027-03-08",
      dueToday: { count: 0, totalCents: 0, items: [] },
      dueThisWeek: { count: 0, totalCents: 0, items: [] },
      overdue: { count: 0, totalCents: 0, items: [] },
      pendingReview: { count: 0, totalCents: 0, items: [] },
    },
    invalid: { referenceDate: "01/03/2027", weekEndDate: 20270308, dueToday: { count: -1 } },
  },
  {
    name: "allocationPreviewRequest",
    schema: allocationPreviewRequest,
    body: { loanId: id(2), amountCents: 115000, paidAt: "2027-02-16" },
    invalid: { loanId: "x", amountCents: 0, paidAt: "2027-13-01" },
  },
  {
    name: "allocationPreviewResponse",
    schema: allocationPreviewResponse,
    body: {
      loanId: id(2),
      loanStatus: "ACTIVE",
      paidAt: "2027-02-16",
      amountCents: 115000,
      deferred: false,
      isRecovery: false,
      allocations: [
        {
          installmentNumber: 1,
          dueDate: "2026-12-14",
          lateChargesCents: 0,
          interestCents: 31667,
          principalCents: 83333,
          installmentStatusAfter: "PAID",
        },
      ],
      totals: { lateChargesCents: 0, interestCents: 31667, principalCents: 83333 },
      outstandingBeforeCents: 690000,
      outstandingAfterCents: 575000,
      paysOff: false,
    },
    invalid: { loanId: "x", amountCents: 0, deferred: "no" },
  },
  {
    name: "rejectPaymentRequest",
    schema: rejectPaymentRequest,
    body: { reason: "valor digitado errado" },
    invalid: { reason: "" },
  },
  {
    name: "reversePaymentRequest",
    schema: reversePaymentRequest,
    body: { reason: "comprovante falso" },
    invalid: { reason: "" },
  },
  {
    name: "attachmentUploadUrlRequest",
    schema: attachmentUploadUrlRequest,
    body: { fileName: "comprovante.pdf", contentType: "application/pdf", sizeBytes: 204800 },
    invalid: { fileName: "", contentType: "image/gif", sizeBytes: 10 * 1024 * 1024 + 1 },
  },
  {
    name: "accountEntryRequest",
    schema: accountEntryRequest,
    body: { type: "CAPITAL_IN", amountCents: 1000000, entryDate: "2027-01-02" },
    optional: { justification: "aporte inicial" },
    invalid: { type: "DISBURSEMENT", amountCents: -100, entryDate: "02/01/2027", justification: "  " },
  },
  {
    name: "createPersonRequest",
    schema: createPersonRequest,
    body: { fullName: "Maria da Silva", cpf: "52998224725", phone: "+5511987654321" },
    optional: { email: "maria@example.com", birthDate: "1980-05-20", referredById: id(3), notes: "indicada" },
    invalid: {
      fullName: " ",
      cpf: "52998224726",
      phone: "11987654321",
      email: "maria",
      birthDate: "20/05/1980",
      referredById: uuidV4,
      notes: "x".repeat(2001),
    },
  },
  {
    name: "updatePersonRequest",
    schema: updatePersonRequest,
    body: { version: 3 },
    optional: {
      fullName: "Maria Souza",
      cpf: "52998224725",
      phone: "+5511987654321",
      email: "maria@example.com",
      birthDate: "1980-05-20",
      notes: "indicada",
    },
    invalid: { version: -1, fullName: " ", cpf: "52998224726", phone: "11987654321", email: "maria" },
  },
  {
    name: "personResponse",
    schema: personResponse,
    body: { ...person, version: 1 },
    optional: { email: "maria@example.com", birthDate: "1980-05-20", notes: "indicada" },
    invalid: { version: -1, email: "maria", birthDate: "20/05/1980" },
  },
  {
    name: "personDetailResponse",
    schema: personDetailResponse,
    body: {
      ...person,
      version: 1,
      referrer: null,
      referrals: [{ ...person, id: id(4) }],
      addresses: [{ id: id(5), ...address, isPrimary: true }],
      pixKeys: [{ id: id(6), ...pixKey, isPrimary: true }],
    },
    optional: { email: "maria@example.com", birthDate: "1980-05-20", notes: "indicada" },
    invalid: {
      version: 1.5,
      referrer: { ...person, cpf: "1" },
      referrals: [{ id: "x" }],
      addresses: [{ id: id(5), ...address, isPrimary: true, state: "S" }],
      pixKeys: [{ id: id(6), type: "X", value: "a", isPrimary: true }],
    },
  },
  {
    name: "addressSchema",
    schema: addressSchema,
    body: { id: id(5), ...address, isPrimary: false },
    optional: { complement: "Apto 4" },
    invalid: { ...addressInvalid, id: uuidV4 },
  },
  {
    name: "createAddressRequest",
    schema: createAddressRequest,
    body: address,
    optional: { complement: "Apto 4", isPrimary: true },
    invalid: addressInvalid,
  },
  {
    name: "updateAddressRequest",
    schema: updateAddressRequest,
    body: {},
    optional: { ...address, complement: "Apto 4", isPrimary: true },
    invalid: addressInvalid,
  },
  {
    name: "pixKeySchema",
    schema: pixKeySchema,
    body: { id: id(6), ...pixKey, isPrimary: false },
    invalid: { ...pixKeyInvalid, id: uuidV4 },
  },
  {
    name: "createPixKeyRequest",
    schema: createPixKeyRequest,
    body: pixKey,
    optional: { isPrimary: true },
    invalid: pixKeyInvalid,
  },
  {
    name: "updatePixKeyRequest",
    schema: updatePixKeyRequest,
    body: {},
    optional: { ...pixKey, isPrimary: true },
    invalid: pixKeyInvalid,
  },
  {
    name: "personListQuery",
    schema: personListQuery,
    body: {},
    optional: { search: "joão 123", limit: "50", cursor: "abc" },
    invalid: { search: "x".repeat(101), limit: "101", cursor: "" },
  },
  {
    name: "personListResponse",
    schema: personListResponse,
    body: { items: [person], nextCursor: null },
    invalid: { items: [{ ...person, phone: "+0511987654321" }], nextCursor: 1 },
  },
  {
    name: "defaultTermsResponse",
    schema: defaultTermsResponse,
    body: { ...charges, suggestedMonthlyRateBps: 633, roundingStepCents: 500 },
    invalid: { lateFeeBps: 2.5, gracePeriodDays: -1, suggestedMonthlyRateBps: -633, roundingStepCents: 0 },
  },
  {
    name: "updateDefaultTermsRequest",
    schema: updateDefaultTermsRequest,
    body: { ...charges, suggestedMonthlyRateBps: 633, roundingStepCents: 500 },
    invalid: { lateFeeBps: 10001, gracePeriodDays: 366, suggestedMonthlyRateBps: -1, roundingStepCents: 0 },
  },
  {
    name: "createLoanRequest",
    schema: createLoanRequest,
    body: loan,
    optional: { internalNotes: "cliente antigo" },
    invalid: { personId: "", principalCents: 0, lateFeeBps: -200, gracePeriodDays: 1.5, internalNotes: "  " },
  },
  {
    name: "updateLoanRequest",
    schema: updateLoanRequest,
    body: {},
    optional: { ...simulation, ...charges, internalNotes: "cliente antigo" },
    invalid: {
      type: "BULLET",
      principalCents: 0,
      monthlyInterestRateBps: 6.33,
      installmentCount: 0,
      frequency: { unit: "YEAR", interval: 1 },
      firstDueDate: "2026-12-32",
      internalNotes: "  ",
    },
  },
  {
    name: "loanListResponse",
    schema: loanListResponse,
    body: { items: [listItem], nextCursor: "abc" },
    invalid: { items: [{ ...listItem, loanNumber: "12" }], nextCursor: undefined },
  },
  {
    name: "loanDetailResponse",
    schema: loanDetailResponse,
    body: {
      ...simulation,
      ...charges,
      id: id(2),
      loanNumber: "2026-0012",
      personId: id(1),
      personName: "Maria da Silva",
      status: "ACTIVE",
      version: 2,
      standing: "CURRENT",
      contractedAt: "2026-11-14",
      disbursedAt: "2026-11-14",
      roundingStepCents: 500,
      totalCents: 690000,
      interestCents: 190000,
      paidCents: 230000,
      outstandingCents: 460000,
      installments: [installment],
    },
    invalid: {
      status: "OPEN",
      version: 0,
      standing: "LATE",
      disbursedAt: "2026-11-31",
      installments: [{ ...installment, status: "DONE" }],
    },
  },
  {
    name: "createPaymentRequest",
    schema: createPaymentRequest,
    body: payment,
    invalid: { loanId: "x", accountId: "x", method: "CHECK", amountCents: 0, paidAt: "2026-12-32" },
  },
  {
    name: "paymentResponse",
    schema: paymentResponse,
    body: {
      id: id(6),
      loanId: id(2),
      loanNumber: "2026-0001",
      personId: id(1),
      personName: "Ana Souza",
      accountId: id(3),
      paidAt: "2026-12-13",
      amountCents: 115000,
      method: "PIX",
      status: "PENDING_REVIEW",
      isRecovery: false,
      createdAt: "2026-12-13T12:00:00-03:00",
      confirmedAt: null,
      reversedAt: null,
      version: 1,
      reversalReason: null,
      loanStatus: "ACTIVE",
      allocations: [],
    },
    invalid: { status: "PAID", version: 0, loanStatus: "OPEN", loanNumber: "1", createdAt: "2026-12-13" },
  },
  {
    name: "paymentListQuery",
    schema: paymentListQuery,
    body: {},
    optional: { status: "CONFIRMED", loanId: id(2), limit: "20", cursor: "abc" },
    invalid: { status: "PAID", loanId: "x", limit: "0", cursor: "" },
  },
  {
    name: "paymentListResponse",
    schema: paymentListResponse,
    body: { items: [], nextCursor: null },
    invalid: { items: "x", nextCursor: 1 },
  },
  {
    name: "accountEntryResponse",
    schema: accountEntryResponse,
    body: {
      id: id(5),
      accountId: id(4),
      type: "CAPITAL_OUT",
      component: null,
      amountCents: -25000,
      entryDate: "2027-01-02",
      justification: null,
      sourceType: null,
      sourceId: null,
      createdAt: "2027-01-02T12:00:00-03:00",
    },
    invalid: { id: "x", type: "TRANSFER", amountCents: 10.5, entryDate: "02/01/2027", createdAt: "ontem" },
  },
  {
    name: "accountListResponse",
    schema: accountListResponse,
    body: { items: [{ id: id(4), name: "Conta principal", active: true, balanceCents: 1000000 }] },
    invalid: { items: [{ id: id(4), name: "", active: true }] },
  },
  {
    name: "treasurySummaryQuery",
    schema: treasurySummaryQuery,
    body: {},
    optional: { month: "2027-01" },
    invalid: { month: "2027-13" },
  },
  {
    name: "treasurySummaryResponse",
    schema: treasurySummaryResponse,
    body: {
      month: "2027-01",
      cashCents: 7000000,
      lentCents: 3000000,
      committedBps: 3000,
      availableBps: 7000,
      maxCommittedBps: null,
      interestReceivedCents: 0,
      lateChargesReceivedCents: 0,
      recoveredCents: 0,
      lossesCents: 0,
      forecastCents: 0,
    },
    invalid: { month: "2027-1", committedBps: 10001, cashCents: 1.5 },
  },
  {
    name: "accountStatementResponse",
    schema: accountStatementResponse,
    body: {
      accountId: id(4),
      from: null,
      to: null,
      openingBalanceCents: 0,
      closingBalanceCents: 0,
      items: [],
      nextCursor: null,
    },
    invalid: { from: "2027-13-01", openingBalanceCents: 1.5, items: "x", nextCursor: 1 },
  },
  {
    name: "accountStatementQuery",
    schema: accountStatementQuery,
    body: {},
    optional: { from: "2027-01-01", to: "2027-01-31", limit: "50", cursor: "abc" },
    invalid: { from: "01/02/2027", to: "2027-02-30", limit: "201", cursor: "" },
  },
  {
    name: "importReportResponse",
    schema: importReportResponse,
    body: {
      id: id(5),
      createdAt: "2027-01-02T12:00:00-03:00",
      totals: {
        rows: 2,
        ok: 1,
        review: 1,
        rejected: 0,
        personsCreated: 2,
        personsReused: 0,
        personsWithoutCpf: 1,
        loansCreated: 2,
        paymentsCreated: 1,
      },
      rows: [{ lineNumber: 3, status: "REVIEW", reasons: ["SCHEDULE_MISMATCH"], personId: id(6), loanId: id(7) }],
    },
    invalid: { id: "x", createdAt: "ontem", totals: { rows: -1 }, rows: "x" },
  },
];

describe.each(cases)("$name", ({ name, schema, body, optional, invalid }) => {
  it(`${name}: accepts a valid body (RFC-004)`, () => {
    expect(schema.safeParse(body).success).toBe(true);
  });

  it(`${name}: accepts the optional fields`, () => {
    expect(schema.safeParse({ ...body, ...optional }).success).toBe(true);
  });

  it(`${name}: rejects a missing required field`, () => {
    for (const key of Object.keys(body)) {
      const rest = Object.fromEntries(Object.entries(body).filter(([k]) => k !== key));
      expect(schema.safeParse(rest).success, `without ${key}`).toBe(false);
    }
  });

  it(`${name}: rejects invalid values`, () => {
    for (const [key, value] of Object.entries(invalid)) {
      expect(schema.safeParse({ ...body, [key]: value }).success, `${key} = ${JSON.stringify(value)}`).toBe(false);
    }
  });

  it(`${name}: rejects unknown fields (calculated fields never come in, ADR-0005)`, () => {
    expect(schema.safeParse({ ...body, totalCentsOverride: 1 }).success).toBe(false);
  });
});

describe("simulateLoan rules", () => {
  it("SINGLE_PAYMENT has exactly one installment", () => {
    const single = { ...simulation, type: "SINGLE_PAYMENT" };
    expect(simulateLoanRequest.safeParse({ ...single, installmentCount: 1 }).success).toBe(true);
    expect(simulateLoanRequest.safeParse({ ...single, installmentCount: 2 }).success).toBe(false);
  });

  it("a schedule line total is principal + interest (RFC-005 installments)", () => {
    const response = { interestCents: 0, totalCents: 0, installmentAmountCents: 0, periodRateBps: 0 };
    expect(simulateLoanResponse.safeParse({ ...response, schedule: [{ ...line, totalCents: 115001 }] }).success).toBe(
      false,
    );
  });
});

describe("problemSchema rules", () => {
  it("carries field errors and the successor loan (RFC-004 §6)", () => {
    const validation = { title: "Inválido", status: 400, detail: "Confira os campos.", code: "VALIDATION_FAILED" };
    expect(
      problemSchema.safeParse({ ...validation, errors: [{ field: "cpf", message: "CPF inválido" }] }).success,
    ).toBe(true);
    expect(problemSchema.safeParse({ ...validation, errors: [] }).success).toBe(false);
    const closed = { title: "Encerrado", status: 422, detail: "Contrato renovado.", code: "LOAN_CLOSED_FOR_PAYMENTS" };
    expect(problemSchema.safeParse({ ...closed, successorLoanId: id(7) }).success).toBe(true);
  });
});

describe("accountEntryRequest rules (RF-30)", () => {
  const adjustment = { type: "ADJUSTMENT", entryDate: "2027-01-02", justification: "diferença no extrato" };

  it("an adjustment may be negative but never zero", () => {
    expect(accountEntryRequest.safeParse({ ...adjustment, amountCents: -2500 }).success).toBe(true);
    expect(accountEntryRequest.safeParse({ ...adjustment, amountCents: 0 }).success).toBe(false);
  });

  it("an adjustment requires a justification (RFC-005)", () => {
    const bare = { type: "ADJUSTMENT", entryDate: "2027-01-02", amountCents: 100 };
    expect(accountEntryRequest.safeParse(bare).success).toBe(false);
  });

  it("a capital withdrawal is positive; the type gives the sign", () => {
    const out = { type: "CAPITAL_OUT", entryDate: "2027-01-02" };
    expect(accountEntryRequest.safeParse({ ...out, amountCents: 5000 }).success).toBe(true);
    expect(accountEntryRequest.safeParse({ ...out, amountCents: -5000 }).success).toBe(false);
  });
});

describe("attachment types (iPhone photos included)", () => {
  it.each(["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"])(
    "accepts %s",
    (contentType) => {
      const body = { fileName: "foto.heic", contentType, sizeBytes: 3_000_000 };
      expect(attachmentUploadUrlRequest.safeParse(body).success).toBe(true);
    },
  );
});

describe("cpfSchema (RN-P01)", () => {
  it.each(["52998224725", "12345678909", "11144477735", "00000000191", "98765432100"])("accepts %s", (cpf) => {
    expect(cpfSchema.safeParse(cpf).success).toBe(true);
  });

  it.each(["52998224726", "52998224715", "11111111111", "5299822472", "529982247250", "529.982.247-25"])(
    "rejects %s",
    (cpf) => {
      expect(cpfSchema.safeParse(cpf).success).toBe(false);
    },
  );
});

describe("createLoanRequest rules (RF-11)", () => {
  it("SINGLE_PAYMENT has exactly one installment", () => {
    const single = { ...loan, type: "SINGLE_PAYMENT" };
    expect(createLoanRequest.safeParse({ ...single, installmentCount: 1 }).success).toBe(true);
    expect(createLoanRequest.safeParse({ ...single, installmentCount: 2 }).success).toBe(false);
  });
});

describe("phoneSchema and loanNumberSchema (RFC-005)", () => {
  it.each(["+5511987654321", "+14155550123"])("accepts the phone %s", (phone) => {
    expect(phoneSchema.safeParse(phone).success).toBe(true);
  });

  it.each(["5511987654321", "+05511987654321", "+55 11 98765-4321", "+5511987654321999"])(
    "rejects the phone %s",
    (phone) => {
      expect(phoneSchema.safeParse(phone).success).toBe(false);
    },
  );

  it.each([
    ["2026-0012", true],
    ["2026-12", false],
    ["26-0012", false],
  ])("loan number %s is valid: %s", (loanNumber, valid) => {
    expect(loanNumberSchema.safeParse(loanNumber).success).toBe(valid);
  });
});

describe("personListQuery rules (RF-04)", () => {
  it("defaults the limit to 20", () => {
    expect(personListQuery.parse({})).toEqual({ limit: 20 });
  });

  it.each([
    ["1", 1],
    ["100", 100],
    ["20", 20],
  ])("accepts limit %s", (text, limit) => {
    expect(personListQuery.parse({ limit: text }).limit).toBe(limit);
  });

  it.each(["0", "101", " 6 ", "1e1", "6.5", "-1", "abc", ""])("rejects limit %j", (text) => {
    expect(personListQuery.safeParse({ limit: text }).success).toBe(false);
  });

  it.each(["maria", "JOÃO da silva", "529.982", "52998", "maria 52998", "a1b2"])(
    "keeps the search %j as plain text",
    (search) => {
      expect(personListQuery.parse({ search }).search).toBe(search);
    },
  );

  it("trims the search", () => {
    expect(personListQuery.parse({ search: "  maria  " }).search).toBe("maria");
  });
});

describe("masked CPF and phone in person bodies (RF-01)", () => {
  const base = { fullName: "Maria da Silva", cpf: "529.982.247-25", phone: "+55 (11) 98765-4321" };

  it("createPersonRequest normalizes CPF and phone", () => {
    const parsed = createPersonRequest.parse(base);
    expect(parsed.cpf).toBe("52998224725");
    expect(parsed.phone).toBe("+5511987654321");
  });

  it("updatePersonRequest normalizes CPF and phone", () => {
    const parsed = updatePersonRequest.parse({ ...base, version: 2 });
    expect(parsed.cpf).toBe("52998224725");
    expect(parsed.phone).toBe("+5511987654321");
  });

  it("still checks the digits after removing the mask", () => {
    expect(createPersonRequest.safeParse({ ...base, cpf: "529.982.247-26" }).success).toBe(false);
    expect(createPersonRequest.safeParse({ ...base, phone: "(11) 98765-4321" }).success).toBe(false);
  });

  it.each([null, "texto", [1]])("lets the schema reject a body that is not an object (%j)", (body) => {
    expect(createPersonRequest.safeParse(body).success).toBe(false);
  });

  it("ignores non-string cpf and phone", () => {
    expect(createPersonRequest.safeParse({ ...base, cpf: 52998224725, phone: 5511987654321 }).success).toBe(false);
  });
});

describe("DUPLICATE_CPF problem code (D8)", () => {
  const duplicate = { title: "CPF duplicado", detail: "CPF já cadastrado.", code: "DUPLICATE_CPF" };

  it("maps to 409 and only to 409", () => {
    expect(problemSchema.safeParse({ ...duplicate, status: 409 }).success).toBe(true);
    expect(problemSchema.safeParse({ ...duplicate, status: 422 }).success).toBe(false);
  });
});

describe("INTERNAL_ERROR problem code", () => {
  it("maps to 500", () => {
    const internal = { title: "Erro interno", detail: "Erro interno do servidor.", code: "INTERNAL_ERROR" };
    expect(problemSchema.safeParse({ ...internal, status: 500 }).success).toBe(true);
  });
});
