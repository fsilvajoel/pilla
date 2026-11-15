import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { installmentOverdueV1 } from "./installment-overdue";
import { installmentPaidV1 } from "./installment-paid";
import { loanActivatedV1 } from "./loan-activated";
import { loanPaidOffV1 } from "./loan-paid-off";
import { loanRenegotiatedV1 } from "./loan-renegotiated";
import { loanRenewedV1 } from "./loan-renewed";
import { loanReopenedV1 } from "./loan-reopened";
import { loanWrittenOffV1 } from "./loan-written-off";
import { paymentConfirmedV1 } from "./payment-confirmed";
import { paymentReversedV1 } from "./payment-reversed";

// RFC-004 §7. Ids fictícios em UUID v7.
const id = (n: number): string => `01936f8e-7b2c-7cde-8f00-${String(n).padStart(12, "0")}`;
const allocation = { installmentId: id(9), lateChargesCents: 2500, interestCents: 20000, principalCents: 80000 };

interface EventCase {
  readonly type: string;
  readonly schema: z.ZodType;
  /** payload válido mínimo (só obrigatórios). */
  readonly payload: Record<string, unknown>;
  /** campos opcionais válidos: o evento também passa com eles. */
  readonly optional?: Record<string, unknown>;
  /** um valor inválido por campo (cada um deve ser recusado). */
  readonly invalid: Record<string, unknown>;
}

const cases: EventCase[] = [
  {
    type: "PaymentConfirmed",
    schema: paymentConfirmedV1,
    payload: {
      paymentId: id(1),
      loanId: id(2),
      personId: id(3),
      accountId: id(4),
      paidAt: "2027-02-16",
      amountCents: 102500,
      allocations: [allocation],
      isRecovery: false,
    },
    invalid: {
      paymentId: "not-a-uuid",
      paidAt: "2027-02-30",
      amountCents: 0,
      allocations: [],
      isRecovery: "no",
      accountId: "550e8400-e29b-41d4-a716-446655440000",
    },
  },
  {
    type: "LoanActivated",
    schema: loanActivatedV1,
    payload: { loanId: id(2), personId: id(3), accountId: id(4), principalCents: 500000, disbursedAt: "2027-01-01" },
    optional: { originLoanId: id(5), originType: "RENEWAL" },
    invalid: { principalCents: -1, disbursedAt: "01/01/2027", originType: "GIFT", originLoanId: "x", personId: 3 },
  },
  {
    type: "LoanPaidOff",
    schema: loanPaidOffV1,
    payload: { loanId: id(2), personId: id(3), paidOffAt: "2027-07-01" },
    invalid: { loanId: "", paidOffAt: "2027-07-01T10:00:00-03:00" },
  },
  {
    type: "LoanReopened",
    schema: loanReopenedV1,
    payload: { loanId: id(2), reason: "estorno do pagamento final" },
    invalid: { reason: "   " },
  },
  {
    type: "LoanRenewed",
    schema: loanRenewedV1,
    payload: { loanId: id(2), successorLoanId: id(5) },
    invalid: { successorLoanId: null },
  },
  {
    type: "LoanRenegotiated",
    schema: loanRenegotiatedV1,
    payload: { loanId: id(2), successorLoanId: id(5), capitalizedCents: 120000 },
    invalid: { capitalizedCents: 1.5, successorLoanId: "x" },
  },
  {
    type: "LoanWrittenOff",
    schema: loanWrittenOffV1,
    payload: { loanId: id(2), outstandingPrincipalCents: 300000, reason: "cliente sem contato há 1 ano" },
    invalid: { outstandingPrincipalCents: -5, reason: "" },
  },
  {
    type: "PaymentReversed",
    schema: paymentReversedV1,
    payload: {
      paymentId: id(1),
      loanId: id(2),
      accountId: id(4),
      amountCents: 102500,
      allocations: [allocation],
      reason: "comprovante falso",
    },
    invalid: { amountCents: 0, allocations: [{ ...allocation, interestCents: -1 }], reason: "" },
  },
  {
    type: "InstallmentPaid",
    schema: installmentPaidV1,
    payload: { installmentId: id(9), loanId: id(2), paidAt: "2027-02-16", daysLate: 15 },
    invalid: { daysLate: -1, paidAt: "2027-13-01" },
  },
  {
    type: "InstallmentOverdue",
    schema: installmentOverdueV1,
    payload: { installmentId: id(9), loanId: id(2), personId: id(3), dueDate: "2027-02-01", outstandingCents: 115000 },
    invalid: { outstandingCents: "115000", dueDate: "2027-02-29" },
  },
];

function envelope(type: string, payload: unknown): Record<string, unknown> {
  return { id: id(100), type, version: 1, occurredAt: "2026-11-14T15:30:00-03:00", aggregateId: id(2), payload };
}

describe.each(cases)("$type", ({ type, schema, payload, optional, invalid }) => {
  it(`${type}: accepts a valid event (RFC-004 §7)`, () => {
    expect(schema.safeParse(envelope(type, payload)).success).toBe(true);
  });

  it(`${type}: accepts the optional fields`, () => {
    expect(schema.safeParse(envelope(type, { ...payload, ...optional })).success).toBe(true);
  });

  it(`${type}: rejects a missing required field`, () => {
    for (const key of Object.keys(payload)) {
      const rest = Object.fromEntries(Object.entries(payload).filter(([k]) => k !== key));
      expect(schema.safeParse(envelope(type, rest)).success, `without ${key}`).toBe(false);
    }
  });

  it(`${type}: rejects invalid values`, () => {
    for (const [key, value] of Object.entries(invalid)) {
      expect(
        schema.safeParse(envelope(type, { ...payload, [key]: value })).success,
        `${key} = ${JSON.stringify(value)}`,
      ).toBe(false);
    }
  });

  it(`${type}: rejects unknown payload fields (no personal data in events)`, () => {
    expect(schema.safeParse(envelope(type, { ...payload, cpf: "52998224725" })).success).toBe(false);
  });

  it(`${type}: rejects a wrong type, version or envelope field`, () => {
    expect(schema.safeParse(envelope("Other", payload)).success).toBe(false);
    expect(schema.safeParse({ ...envelope(type, payload), version: 2 }).success).toBe(false);
    expect(schema.safeParse({ ...envelope(type, payload), occurredAt: "2026-11-14T15:30:00" }).success).toBe(false);
    expect(schema.safeParse({ ...envelope(type, payload), extra: 1 }).success).toBe(false);
  });
});

describe("allocations", () => {
  it("PaymentConfirmed: allocations must sum to amountCents (RN-T03)", () => {
    const payload = {
      paymentId: id(1),
      loanId: id(2),
      personId: id(3),
      accountId: id(4),
      paidAt: "2027-02-16",
      amountCents: 102501,
      allocations: [allocation],
      isRecovery: false,
    };
    expect(paymentConfirmedV1.safeParse(envelope("PaymentConfirmed", payload)).success).toBe(false);
  });

  it("PaymentReversed: allocations must sum to amountCents (RN-T03)", () => {
    const payload = {
      paymentId: id(1),
      loanId: id(2),
      accountId: id(4),
      amountCents: 100000,
      allocations: [allocation],
      reason: "x",
    };
    expect(paymentReversedV1.safeParse(envelope("PaymentReversed", payload)).success).toBe(false);
  });
});
