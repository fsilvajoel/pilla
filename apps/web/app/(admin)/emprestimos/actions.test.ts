import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  createLoanDraft: vi.fn(),
  activateLoan: vi.fn(),
  cancelLoan: vi.fn(),
  renewLoan: vi.fn(),
  renegotiateLoan: vi.fn(),
  updateLoan: vi.fn(),
  writeOffLoan: vi.fn(),
}));
const cache = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/api/loans", () => api);
vi.mock("next/cache", () => cache);

import {
  activateLoanAction,
  cancelLoanAction,
  createLoanAction,
  renegotiateLoanAction,
  renewLoanAction,
  updateLoanAction,
  writeOffLoanAction,
} from "./actions";

const ID = "01890a5d-ac96-774b-bcce-b302099a8057";
const validCreate = {
  personId: ID,
  type: "INSTALLMENT",
  principalCents: 500000,
  monthlyInterestRateBps: 633,
  installmentCount: 6,
  frequency: { unit: "MONTH", interval: 1 },
  firstDueDate: "2026-12-14",
  lateFeeBps: 200,
  lateInterestMonthlyBps: 100,
  gracePeriodDays: 0,
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("emprestimos/actions", () => {
  it("recusa criação inválida sem chamar a API", async () => {
    expect((await createLoanAction({})).ok).toBe(false);
    expect(api.createLoanDraft).not.toHaveBeenCalled();
  });

  it("ativa com a versão e revalida", async () => {
    api.activateLoan.mockResolvedValue({ id: ID });
    const result = await activateLoanAction(ID, 1, { disbursedAt: "2026-11-20", accountId: ID });
    expect(result).toEqual({ ok: true, id: ID });
    expect(api.activateLoan).toHaveBeenCalledWith(ID, 1, { disbursedAt: "2026-11-20", accountId: ID });
    expect(cache.revalidatePath).toHaveBeenCalledWith(`/emprestimos/${ID}`);
  });

  it("ativação inválida não chama a API; erro inesperado não vaza", async () => {
    expect((await activateLoanAction(ID, 1, {})).ok).toBe(false);
    expect(api.activateLoan).not.toHaveBeenCalled();
    api.activateLoan.mockRejectedValue(new Error("stack interno"));
    const result = await activateLoanAction(ID, 1, { disbursedAt: "2026-11-20", accountId: ID });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).not.toContain("stack");
  });

  it("cancela com a versão e devolve erro da API", async () => {
    api.cancelLoan.mockResolvedValue({ id: ID });
    expect(await cancelLoanAction(ID, 1)).toEqual({ ok: true, id: ID });
    expect(api.cancelLoan).toHaveBeenCalledWith(ID, 1);
    api.cancelLoan.mockRejectedValue(new Error("x"));
    expect((await cancelLoanAction(ID, 1)).ok).toBe(false);
  });

  it("renova e renegocia, levando ao novo rascunho; recusa entrada inválida", async () => {
    api.renewLoan.mockResolvedValue({ id: ID });
    api.renegotiateLoan.mockResolvedValue({ id: ID });
    expect(await renewLoanAction(ID, { firstDueDate: "2026-12-20" })).toEqual({ ok: true, id: ID });
    expect(await renegotiateLoanAction(ID, { firstDueDate: "2026-12-20" })).toEqual({ ok: true, id: ID });
    expect((await renewLoanAction(ID, {})).ok).toBe(false);
    expect((await renegotiateLoanAction(ID, {})).ok).toBe(false);
    api.renewLoan.mockRejectedValue(new Error("stack interno"));
    api.renegotiateLoan.mockRejectedValue(new Error("stack interno"));
    expect((await renewLoanAction(ID, { firstDueDate: "2026-12-20" })).ok).toBe(false);
    expect((await renegotiateLoanAction(ID, { firstDueDate: "2026-12-20" })).ok).toBe(false);
  });

  it("baixa com motivo e versão; sem motivo não chama a API", async () => {
    api.writeOffLoan.mockResolvedValue({ id: ID });
    expect(await writeOffLoanAction(ID, 3, { reason: "Perda" })).toEqual({ ok: true, id: ID });
    expect(api.writeOffLoan).toHaveBeenCalledWith(ID, 3, { reason: "Perda" });
    expect((await writeOffLoanAction(ID, 3, { reason: "" })).ok).toBe(false);
    api.writeOffLoan.mockRejectedValue(new Error("x"));
    expect((await writeOffLoanAction(ID, 3, { reason: "Perda" })).ok).toBe(false);
  });

  it("edita o rascunho com a versão; entrada inválida não chama a API; erro volta sem vazar", async () => {
    api.updateLoan.mockResolvedValue({ id: ID });
    expect(await updateLoanAction(ID, 2, {})).toEqual({ ok: true, id: ID });
    expect(api.updateLoan).toHaveBeenCalledWith(ID, 2, {});
    expect(cache.revalidatePath).toHaveBeenCalledWith(`/emprestimos/${ID}`);
    api.updateLoan.mockClear();
    expect((await updateLoanAction(ID, 2, { principalCents: -1 })).ok).toBe(false);
    expect(api.updateLoan).not.toHaveBeenCalled();
    api.updateLoan.mockRejectedValue(new Error("stack interno"));
    expect((await updateLoanAction(ID, 2, {})).ok).toBe(false);
  });

  it("criação válida devolve o id e o aviso de contratos ativos; erro da API falha", async () => {
    api.createLoanDraft.mockResolvedValue({ id: ID, warning: { activeLoansCount: 2 } });
    const result = await createLoanAction(validCreate);
    expect(result).toEqual({ ok: true, id: ID, activeLoansCount: 2 });
    expect(cache.revalidatePath).toHaveBeenCalledWith("/emprestimos");
    api.createLoanDraft.mockRejectedValue(new Error("x"));
    expect((await createLoanAction(validCreate)).ok).toBe(false);
  });
});
