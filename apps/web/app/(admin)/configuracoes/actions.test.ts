import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ updateDefaultTerms: vi.fn() }));
const cache = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/api/settings", () => api);
vi.mock("next/cache", () => cache);

import { ApiProblem } from "@/lib/api/problem";
import { updateDefaultTermsAction } from "./actions";

const terms = {
  lateFeeBps: 200,
  lateInterestMonthlyBps: 100,
  gracePeriodDays: 0,
  suggestedMonthlyRateBps: 633,
  roundingStepCents: 500,
};

function failed<T extends { ok: boolean }>(result: T): Extract<T, { ok: false }> {
  if (result.ok) throw new Error("esperava falha");
  return result as Extract<T, { ok: false }>;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("configuracoes/actions", () => {
  it("grava a nova vigência e revalida", async () => {
    api.updateDefaultTerms.mockResolvedValue(terms);
    expect(await updateDefaultTermsAction(terms)).toEqual({ ok: true, terms });
    expect(api.updateDefaultTerms).toHaveBeenCalledWith(terms);
    expect(cache.revalidatePath).toHaveBeenCalledWith("/configuracoes");
  });

  it("recusa entrada inválida sem chamar a API", async () => {
    const result = await updateDefaultTermsAction({ ...terms, roundingStepCents: 0 });
    expect(result).toEqual({ ok: false, message: "Confira os campos.", fieldErrors: {} });
    expect(api.updateDefaultTerms).not.toHaveBeenCalled();
  });

  it("devolve o erro da API com campos; erro interno vira mensagem genérica", async () => {
    api.updateDefaultTerms.mockRejectedValueOnce(
      new ApiProblem(400, {
        title: "Erro",
        status: 400,
        detail: "Detalhe da API",
        code: "VALIDATION_FAILED",
        errors: [{ field: "lateFeeBps", message: "Alto demais" }],
      }),
    );
    const apiError = await updateDefaultTermsAction(terms);
    expect(failed(apiError).fieldErrors).toEqual({ lateFeeBps: "Alto demais" });
    api.updateDefaultTerms.mockRejectedValueOnce(new Error("stack interno"));
    const generic = await updateDefaultTermsAction(terms);
    expect(failed(generic).message).toBe("Não foi possível salvar agora. Tente de novo.");
    expect(cache.revalidatePath).not.toHaveBeenCalled();
  });
});
