import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { proxy } from "./proxy";

afterEach(() => {
  vi.unstubAllEnvs();
});

function call(path: string, cookie?: string): { status: number; location: string | null } {
  const res = proxy(
    new NextRequest(`http://192.168.31.58:3000${path}`, cookie === undefined ? {} : { headers: { cookie } }),
  );
  return { status: res.status, location: res.headers.get("location") };
}

describe("proxy com autenticação ligada", () => {
  it("sem cookie manda rota do admin para /login com next, preservando query", () => {
    expect(call("/pessoas?q=ana&page=2")).toEqual({
      status: 307,
      location: "http://192.168.31.58:3000/login?next=%2Fpessoas%3Fq%3Dana%26page%3D2",
    });
  });

  it("sem cookie a raiz vai para /login sem next", () => {
    expect(call("/").location).toBe("http://192.168.31.58:3000/login");
  });

  it.each(["/login", "/portal", "/portal/contrato", "/_next/static/a.js", "/logo.png"])("deixa passar %s", (path) => {
    expect(call(path).status).toBe(200);
  });

  it("com cookie de sessão deixa passar", () => {
    expect(call("/caixa", "pilla_session=abc").status).toBe(200);
  });
});

describe("proxy com PILLA_AUTH_ENFORCED=false", () => {
  it("não redireciona sem cookie", () => {
    vi.stubEnv("PILLA_AUTH_ENFORCED", "false");
    expect(call("/pessoas").status).toBe(200);
  });
});
