import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  previewAllocation: vi.fn(),
  createPayment: vi.fn(),
  confirmPayment: vi.fn(),
  rejectPayment: vi.fn(),
  reversePayment: vi.fn(),
}));
const cache = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/api/payments", () => api);
vi.mock("next/cache", () => cache);

import { ApiProblem } from "@/lib/api/problem";
import {
  confirmPaymentAction,
  createPaymentAction,
  previewPaymentAction,
  rejectPaymentAction,
  reversePaymentAction,
} from "./actions";

const ID = "01890a5d-ac96-774b-bcce-b302099a8057";
const body = { loanId: ID, accountId: ID, paidAt: "2026-11-20", amountCents: 1000, method: "PIX" };

beforeEach(() => {
  vi.resetAllMocks();
});

describe("pagamentos/actions", () => {
  it("prévia inválida não chama a API", async () => {
    const result = await previewPaymentAction({});
    expect(result.ok).toBe(false);
    expect(api.previewAllocation).not.toHaveBeenCalled();
  });

  it("prévia válida devolve a resposta da API; erro vira mensagem em pt-BR", async () => {
    api.previewAllocation.mockResolvedValue({ deferred: true });
    expect(await previewPaymentAction({ loanId: ID, amountCents: 1000, paidAt: "2026-11-20" })).toEqual({
      ok: true,
      data: { deferred: true },
    });
    api.previewAllocation.mockRejectedValue(new Error("interno"));
    const result = await previewPaymentAction({ loanId: ID, amountCents: 1000, paidAt: "2026-11-20" });
    expect(result.ok).toBe(false);
  });

  it("registra com a Idempotency-Key e revalida a fila e o contrato", async () => {
    api.createPayment.mockResolvedValue({ id: ID, loanId: ID });
    const result = await createPaymentAction(body, "chave-1");
    expect(result.ok).toBe(true);
    expect(api.createPayment).toHaveBeenCalledWith(body, "chave-1");
    expect(cache.revalidatePath).toHaveBeenCalledWith("/pagamentos");
    expect(cache.revalidatePath).toHaveBeenCalledWith(`/emprestimos/${ID}`);
  });

  it("registro inválido aponta o campo e não chama a API", async () => {
    const result = await createPaymentAction({ ...body, amountCents: 0 }, "chave-1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.fieldErrors)).toContain("amountCents");
    expect(api.createPayment).not.toHaveBeenCalled();
  });

  it("confirma com a versão", async () => {
    api.confirmPayment.mockResolvedValue({ id: ID, loanId: ID });
    expect((await confirmPaymentAction(ID, 1)).ok).toBe(true);
    expect(api.confirmPayment).toHaveBeenCalledWith(ID, 1);
  });

  it("rejeita e estorna só com motivo", async () => {
    expect((await rejectPaymentAction(ID, 1, { reason: "  " })).ok).toBe(false);
    expect((await reversePaymentAction(ID, 2, {})).ok).toBe(false);
    expect(api.rejectPayment).not.toHaveBeenCalled();
    expect(api.reversePayment).not.toHaveBeenCalled();
    api.rejectPayment.mockResolvedValue({ id: ID, loanId: ID });
    api.reversePayment.mockResolvedValue({ id: ID, loanId: ID });
    expect((await rejectPaymentAction(ID, 1, { reason: "duplicado" })).ok).toBe(true);
    expect((await reversePaymentAction(ID, 2, { reason: "erro" })).ok).toBe(true);
    expect(api.rejectPayment).toHaveBeenCalledWith(ID, 1, { reason: "duplicado" });
    expect(api.reversePayment).toHaveBeenCalledWith(ID, 2, { reason: "erro" });
  });

  it("erro da API em ação vira mensagem em pt-BR", async () => {
    api.confirmPayment.mockRejectedValue(
      new ApiProblem(409, {
        title: "x",
        status: 409,
        detail: "en",
        code: "PAYMENT_NOT_PENDING",
      }),
    );
    const result = await confirmPaymentAction(ID, 1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("não está mais aguardando");
  });
});
