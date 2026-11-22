import { describe, expect, it } from "vitest";
import { ProblemException } from "../../core/http/problem-exception";
import type { PaymentRow } from "../infra/schema";
import { lookedUp, toListItem } from "./payment-views";

const row: PaymentRow = {
  id: "01970000-0000-7000-8000-000000000201",
  loanId: "01970000-0000-7000-8000-000000000011",
  personId: "01970000-0000-7000-8000-000000000001",
  accountId: "01970000-0000-7000-8000-000000000003",
  paidAt: "2026-11-20",
  amountCents: 1000,
  method: "PIX",
  receiptAttachmentId: null,
  pixEndToEndId: null,
  channel: "ADMIN",
  status: "PENDING_REVIEW",
  isRecovery: false,
  idempotencyKey: null,
  confirmedAt: null,
  confirmedBy: null,
  reversedAt: null,
  reversedBy: null,
  reversalReason: null,
  rejectedAt: null,
  rejectedBy: null,
  rejectionReason: null,
  createdAt: new Date("2026-11-20T15:00:00Z"),
  createdBy: "01970000-0000-7000-8000-000000000004",
  updatedAt: new Date("2026-11-20T15:00:00Z"),
  version: 1,
};

function detailOf(work: () => unknown): string | undefined {
  try {
    work();
  } catch (error) {
    return error instanceof ProblemException ? `${error.code}: ${error.detail}` : undefined;
  }
  return undefined;
}

describe("payment views: dado que falta em outro módulo", () => {
  it("lookedUp answers INTERNAL_ERROR when the id is missing and the value when it is there", () => {
    expect(detailOf(() => lookedUp(new Map(), "x", "Pessoa"))).toBe(
      "INTERNAL_ERROR: Pessoa do pagamento não encontrado.",
    );
    expect(lookedUp(new Map([["x", "Ana"]]), "x", "Pessoa")).toBe("Ana");
  });

  it("toListItem fails when the loan number or the person name is missing", () => {
    const names = new Map([[row.personId, "Ana Souza"]]);
    const numbers = new Map([[row.loanId, "2026-0001"]]);
    expect(toListItem(row, numbers, names).personName).toBe("Ana Souza");
    expect(toListItem({ ...row, version: 3 }, numbers, names).version).toBe(3);
    expect(detailOf(() => toListItem(row, new Map(), names))).toBe(
      "INTERNAL_ERROR: Número do contrato do pagamento não encontrado.",
    );
    expect(detailOf(() => toListItem(row, numbers, new Map()))).toBe(
      "INTERNAL_ERROR: Pessoa do pagamento não encontrado.",
    );
  });
});
