// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const redirect = vi.fn((url: string): never => {
  throw new Error(`redirect:${url}`);
});
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("next/headers", () => ({
  cookies: () => Promise.reject(new Error("fora de uma requisição")),
  headers: () => Promise.resolve(new Headers({ "next-url": "/pessoas?q=a" })),
}));

const { currentPath, readSessionToken, redirectToLogin, safeNextPath } = await import("./session");

describe("safeNextPath", () => {
  it.each([
    ["/pessoas", "/pessoas"],
    ["/pessoas?q=a b", "/pessoas?q=a b"],
    ["//evil.com", "/"],
    ["http://evil.com", "/"],
    ["/\\evil.com", "/"],
    ["pessoas", "/"],
    ["/a\nb", "/"],
    ["", "/"],
    [undefined, "/"],
    [null, "/"],
  ])("%j -> %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });
});

describe("sessão", () => {
  it("sem requisição não há token", async () => {
    expect(await readSessionToken()).toBeUndefined();
  });

  it("currentPath lê o cabeçalho next-url", async () => {
    expect(await currentPath()).toBe("/pessoas?q=a");
  });

  it("redirectToLogin guarda a rota de origem codificada", () => {
    expect(() => redirectToLogin("/pessoas?q=a")).toThrow("redirect:/login?next=%2Fpessoas%3Fq%3Da");
  });

  it("redirectToLogin sem rota (ou externa) vai para /login", () => {
    expect(() => redirectToLogin()).toThrow("redirect:/login");
    expect(() => redirectToLogin("//x")).toThrow("redirect:/login");
  });
});
