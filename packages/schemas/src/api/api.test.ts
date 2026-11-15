import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { cpfSchema } from "../common";
import { adminLoginRequest } from "./access/admin-login";
import { portalAccessRequest } from "./access/portal-access";
import { portalSessionRequest } from "./access/portal-session";
import { attachmentUploadUrlRequest } from "./core/attachment-upload-url";
import { activateLoanRequest } from "./lending/activate-loan";
import { payoffQuoteQuery } from "./lending/payoff-quote";
import { simulateLoanRequest, simulateLoanResponse } from "./lending/simulate-loan";
import { writeOffLoanRequest } from "./lending/write-off-loan";
import { allocationPreviewRequest } from "./payments/allocation-preview";
import { reversePaymentRequest } from "./payments/reverse-payment";
import { problemSchema } from "./problem";

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
    name: "payoffQuoteQuery",
    schema: payoffQuoteQuery,
    body: { date: "2027-03-01" },
    invalid: { date: "01/03/2027" },
  },
  {
    name: "allocationPreviewRequest",
    schema: allocationPreviewRequest,
    body: { loanId: id(2), amountCents: 115000, paidAt: "2027-02-16" },
    invalid: { loanId: "x", amountCents: 0, paidAt: "2027-13-01" },
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
    invalid: { fileName: "", contentType: "", sizeBytes: 0 },
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
