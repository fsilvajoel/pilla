import type { ErrorCode } from "@pilla/schemas";
import { describe, expect, it } from "vitest";
import { ApiProblem } from "@/lib/api/problem";
import { acceptsPayment, expectedVersion, toPaymentActionError } from "./payment-actions";

const problem = (status: number, code: string, extra: object = {}): ApiProblem =>
  new ApiProblem(status, { title: "t", status, detail: "texto da API", code: code as ErrorCode, ...extra });

describe("toPaymentActionError", () => {
  it.each([
    [422, "PAYMENT_EXCEEDS_BALANCE", "maior que o saldo"],
    [422, "LOAN_CLOSED_FOR_PAYMENTS", "encerrado"],
    [409, "LOAN_NOT_ACTIVE", "não está ativo"],
    [409, "PAYMENT_NOT_PENDING", "aguardando conferência"],
    [409, "PAYMENT_NOT_CONFIRMED", "não está confirmado"],
    [422, "REVERSAL_BLOCKED_BY_SUCCESSOR", "renovado ou renegociado"],
    [409, "VERSION_CONFLICT", "alterado por outra pessoa"],
  ])("traduz %s %s", (status, code, text) => {
    const result = toPaymentActionError(problem(status, code));
    expect(result.code).toBe(code);
    expect(result.message).toContain(text);
  });

  it("repassa o contrato sucessor", () => {
    const sucessor = "01890a5d-ac96-774b-bcce-b302099a8057";
    const result = toPaymentActionError(problem(422, "LOAN_CLOSED_FOR_PAYMENTS", { successorLoanId: sucessor }));
    expect(result.successorLoanId).toBe(sucessor);
  });

  it("não vaza erro desconhecido", () => {
    const result = toPaymentActionError(new Error("stack interno"));
    expect(result.code).toBeNull();
    expect(result.message).not.toContain("stack");
  });
});

describe("expectedVersion e acceptsPayment", () => {
  it("pendente é a versão 1 e confirmado a 2", () => {
    expect(expectedVersion("PENDING_REVIEW")).toBe(1);
    expect(expectedVersion("CONFIRMED")).toBe(2);
  });

  it("aceita DRAFT, ACTIVE e WRITTEN_OFF", () => {
    expect(["DRAFT", "ACTIVE", "WRITTEN_OFF"].every(acceptsPayment)).toBe(true);
    expect(["PAID_OFF", "RENEWED", "RENEGOTIATED", "CANCELLED"].some(acceptsPayment)).toBe(false);
  });
});
