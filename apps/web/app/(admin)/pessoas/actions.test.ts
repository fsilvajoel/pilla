import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ createPerson: vi.fn(), updatePerson: vi.fn(), listPeople: vi.fn() }));
const cache = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/api/people", () => api);
vi.mock("next/cache", () => cache);

import { createPersonAction, searchPeopleAction, updatePersonAction } from "./actions";

const body = { fullName: "Ana Costa", cpf: "52998224725", phone: "+5511987654321" };

beforeEach(() => {
  vi.resetAllMocks();
});

describe("pessoas/actions", () => {
  it("cria, revalida a lista e devolve o id", async () => {
    api.createPerson.mockResolvedValue({ id: "p1" });
    expect(await createPersonAction(body)).toEqual({ ok: true, id: "p1" });
    expect(cache.revalidatePath).toHaveBeenCalledWith("/pessoas");
  });

  it("recusa entrada inválida sem chamar a API", async () => {
    const result = await createPersonAction({ ...body, cpf: "1" });
    expect(result.ok).toBe(false);
    expect(api.createPerson).not.toHaveBeenCalled();
  });

  it("não vaza detalhe de erro inesperado", async () => {
    api.createPerson.mockRejectedValue(new Error("stack interno"));
    const result = await createPersonAction(body);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).not.toContain("stack");
  });

  it("edita e revalida lista e ficha", async () => {
    api.updatePerson.mockResolvedValue({ id: "p1" });
    expect(await updatePersonAction("p1", { ...body, version: 1 })).toEqual({ ok: true, id: "p1" });
    expect(cache.revalidatePath).toHaveBeenCalledWith("/pessoas/p1");
  });

  it("edição inválida e erro da API", async () => {
    expect((await updatePersonAction("p1", { ...body })).ok).toBe(false);
    api.updatePerson.mockRejectedValue(new Error("x"));
    expect((await updatePersonAction("p1", { ...body, version: 1 })).ok).toBe(false);
  });

  it("busca só com 2+ caracteres e engole falhas", async () => {
    expect(await searchPeopleAction(" a ")).toEqual([]);
    api.listPeople.mockResolvedValue({ items: [{ id: "x" }], nextCursor: null });
    expect(await searchPeopleAction("ana")).toEqual([{ id: "x" }]);
    api.listPeople.mockRejectedValue(new Error("x"));
    expect(await searchPeopleAction("ana")).toEqual([]);
  });
});
