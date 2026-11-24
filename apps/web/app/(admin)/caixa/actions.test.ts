import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ createAccountEntry: vi.fn() }));
const cache = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/api/treasury", () => api);
vi.mock("next/cache", () => cache);

import { ApiProblem } from "@/lib/api/problem";
import { createEntryAction } from "./actions";

const ID = "01890a5d-ac96-774b-bcce-b302099a8057";
const entry = { type: "CAPITAL_IN", amountCents: 1000, entryDate: "2026-11-20" };

function failed<T extends { ok: boolean }>(result: T): Extract<T, { ok: false }> {
  if (result.ok) throw new Error("esperava falha");
  return result as Extract<T, { ok: false }>;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("caixa/actions", () => {
  it("grava o lançamento com a chave de idempotência e revalida /caixa", async () => {
    api.createAccountEntry.mockResolvedValue({ id: ID });
    const result = await createEntryAction(ID, entry, "chave");
    expect(result).toEqual({ ok: true, data: { id: ID } });
    expect(api.createAccountEntry).toHaveBeenCalledWith(ID, entry, "chave");
    expect(cache.revalidatePath).toHaveBeenCalledWith("/caixa");
  });

  it("entrada inválida volta com erro por campo e não chama a API", async () => {
    const result = await createEntryAction(ID, { type: "X", amountCents: -1 }, "chave");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("VALIDATION_FAILED");
      expect(Object.keys(result.fieldErrors).length).toBeGreaterThan(0);
    }
    expect(api.createAccountEntry).not.toHaveBeenCalled();
  });

  it("conta inexistente vira mensagem própria; erro interno não vaza", async () => {
    api.createAccountEntry.mockRejectedValueOnce(
      new ApiProblem(404, { title: "Erro", status: 404, detail: "x", code: "NOT_FOUND" }),
    );
    const notFound = await createEntryAction(ID, entry, "chave");
    expect(failed(notFound).message).toBe("Conta não encontrada.");
    api.createAccountEntry.mockRejectedValueOnce(new Error("stack interno"));
    const generic = await createEntryAction(ID, entry, "chave");
    expect(failed(generic).message).not.toContain("stack");
    expect(cache.revalidatePath).not.toHaveBeenCalled();
  });
});
