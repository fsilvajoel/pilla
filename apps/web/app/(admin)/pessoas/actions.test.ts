import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  createPerson: vi.fn(),
  updatePerson: vi.fn(),
  listPeople: vi.fn(),
  addAddress: vi.fn(),
  updateAddress: vi.fn(),
  deleteAddress: vi.fn(),
  addPixKey: vi.fn(),
  updatePixKey: vi.fn(),
  deletePixKey: vi.fn(),
}));
const cache = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/api/people", () => api);
vi.mock("next/cache", () => cache);
vi.mock("@/lib/api/portal-access", () => ({ setPortalAccess: vi.fn() }));

import type { CreateAddressRequest, CreatePixKeyRequest } from "@pilla/schemas";
import { ApiProblem } from "@/lib/api/problem";
import {
  addAddressAction,
  addPixKeyAction,
  createPersonAction,
  deleteAddressAction,
  deletePixKeyAction,
  searchPeopleAction,
  setPrimaryAddressAction,
  setPrimaryPixKeyAction,
  updateAddressAction,
  updatePersonAction,
  updatePixKeyAction,
} from "./actions";

const address: CreateAddressRequest = {
  street: "Rua A",
  number: "10",
  district: "Centro",
  city: "São Paulo",
  state: "SP",
  postalCode: "01001000",
};
const pixKey: CreatePixKeyRequest = { type: "EMAIL", value: "ana@example.com" };

function problem(status: number, code: "NOT_FOUND" | "VALIDATION_FAILED"): ApiProblem {
  return new ApiProblem(status, {
    title: "Erro",
    status,
    detail: "Detalhe da API",
    code,
    ...(code === "VALIDATION_FAILED" ? { errors: [{ field: "street", message: "Obrigatório" }] } : {}),
  });
}

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

  it("mutações de endereço e PIX chamam a API e revalidam", async () => {
    api.addAddress.mockResolvedValue({});
    api.updateAddress.mockResolvedValue({});
    api.deleteAddress.mockResolvedValue(undefined);
    api.addPixKey.mockResolvedValue({});
    api.updatePixKey.mockResolvedValue({});
    api.deletePixKey.mockResolvedValue(undefined);
    expect((await addAddressAction("p1", address)).ok).toBe(true);
    expect(cache.revalidatePath).toHaveBeenCalledWith("/pessoas/p1");
    expect((await updateAddressAction("a1", {})).ok).toBe(true);
    expect(cache.revalidatePath).toHaveBeenCalledWith("/pessoas/[id]", "page");
    expect((await deleteAddressAction("a1")).ok).toBe(true);
    expect((await addPixKeyAction("p1", pixKey)).ok).toBe(true);
    expect((await updatePixKeyAction("k1", {})).ok).toBe(true);
    expect((await deletePixKeyAction("k1")).ok).toBe(true);
    expect((await setPrimaryAddressAction("p1", "a1")).ok).toBe(true);
    expect(api.updateAddress).toHaveBeenLastCalledWith("a1", { isPrimary: true });
    expect((await setPrimaryPixKeyAction("p1", "k1")).ok).toBe(true);
    expect(api.updatePixKey).toHaveBeenLastCalledWith("k1", { isPrimary: true });
  });

  it("erro 4xx da API volta como resultado sem revalidar", async () => {
    api.deleteAddress.mockRejectedValue(problem(422, "VALIDATION_FAILED"));
    const result = await deleteAddressAction("a1");
    expect(result).toMatchObject({ ok: false, code: "VALIDATION_FAILED", fieldErrors: { street: "Obrigatório" } });
    expect(cache.revalidatePath).not.toHaveBeenCalled();
  });

  it("404 revalida a página para sumir o item", async () => {
    api.deletePixKey.mockRejectedValue(problem(404, "NOT_FOUND"));
    const result = await deletePixKeyAction("k1");
    expect(result).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(cache.revalidatePath).toHaveBeenCalledWith("/pessoas/[id]", "page");
  });
});
