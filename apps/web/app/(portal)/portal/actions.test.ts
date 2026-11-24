import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }));
const nav = vi.hoisted(() => ({
  redirect: vi.fn((url: string): never => {
    throw new Error(`redirect:${url}`);
  }),
}));
const portal = vi.hoisted(() => ({ createPortalSession: vi.fn(), deletePortalSession: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: () => Promise.resolve(store) }));
vi.mock("next/navigation", () => nav);
vi.mock("@/lib/api/portal", () => ({ ...portal, PORTAL_COOKIE: "pilla_portal" }));

import { ApiProblem } from "@/lib/api/problem";
import { portalTexts } from "@/lib/portal-texts";
import { enterAction, signOutAction } from "./actions";

function form(cpf: string | File | null): FormData {
  const data = new FormData();
  if (cpf !== null) data.set("cpf", cpf);
  return data;
}

function problem(status: number): ApiProblem {
  return new ApiProblem(status, { title: "Erro", status, detail: "x", code: "NOT_FOUND" });
}

beforeEach(() => {
  vi.resetAllMocks();
  nav.redirect.mockImplementation((url: string): never => {
    throw new Error(`redirect:${url}`);
  });
});

describe("enterAction", () => {
  it("CPF inválido ou ausente não chama a API", async () => {
    expect(await enterAction({ error: null }, form("123"))).toEqual({ error: portalTexts.entry.invalidCpf });
    expect(await enterAction({ error: null }, form(null))).toEqual({ error: portalTexts.entry.invalidCpf });
    expect(await enterAction({ error: null }, form(new File(["x"], "a.txt")))).toEqual({
      error: portalTexts.entry.invalidCpf,
    });
    expect(portal.createPortalSession).not.toHaveBeenCalled();
  });

  it("CPF válido com máscara: grava o cookie em /portal e vai para os contratos", async () => {
    portal.createPortalSession.mockResolvedValue({ token: "tok", maxAgeSeconds: 1800 });
    await expect(enterAction({ error: null }, form("529.982.247-25"))).rejects.toThrow("redirect:/portal/contratos");
    expect(portal.createPortalSession).toHaveBeenCalledWith("52998224725");
    expect(store.set).toHaveBeenCalledWith("pilla_portal", "tok", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/portal",
      maxAge: 1800,
    });
  });

  it.each([
    [401, portalTexts.entry.unauthorized],
    [429, portalTexts.entry.tooManyAttempts],
    [400, portalTexts.entry.invalidCpf],
    [500, portalTexts.entry.unexpected],
  ])("erro %i da API vira o texto do portal, sem cookie", async (status, text) => {
    portal.createPortalSession.mockRejectedValue(problem(status));
    expect(await enterAction({ error: null }, form("52998224725"))).toEqual({ error: text });
    expect(store.set).not.toHaveBeenCalled();
    expect(nav.redirect).not.toHaveBeenCalled();
  });

  it("falha que não é da API vira erro inesperado", async () => {
    portal.createPortalSession.mockRejectedValue(new Error("rede"));
    expect(await enterAction({ error: null }, form("52998224725"))).toEqual({ error: portalTexts.entry.unexpected });
  });
});

describe("signOutAction", () => {
  it("apaga a sessão na API e o cookie, e volta para /portal", async () => {
    store.get.mockReturnValue({ value: "tok" });
    await expect(signOutAction()).rejects.toThrow("redirect:/portal");
    expect(portal.deletePortalSession).toHaveBeenCalledWith("tok");
    expect(store.delete).toHaveBeenCalledWith({ name: "pilla_portal", path: "/portal" });
  });

  it("mesmo com a API falhando, o cookie sai e o redirect acontece", async () => {
    store.get.mockReturnValue(undefined);
    portal.deletePortalSession.mockRejectedValue(new Error("fora do ar"));
    await expect(signOutAction()).rejects.toThrow("redirect:/portal");
    expect(portal.deletePortalSession).toHaveBeenCalledWith(undefined);
    expect(store.delete).toHaveBeenCalledWith({ name: "pilla_portal", path: "/portal" });
  });
});
