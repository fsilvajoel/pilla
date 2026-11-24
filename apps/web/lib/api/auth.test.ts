// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiProblem } from "./problem";

const redirect = vi.fn((url: string): never => {
  throw new Error(`redirect:${url}`);
});
const store = { value: "tok" as string | undefined };
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ get: () => (store.value === undefined ? undefined : { value: store.value }) }),
  headers: () => Promise.resolve(new Headers({ "x-forwarded-for": "203.0.113.9" })),
}));

const { getMe, loginAdmin, logoutAdmin } = await import("./auth");

const ADMIN = { id: "0198a4b2-7c1e-7d3a-8f10-2b6c9d4e5a70", username: "joel", role: "ADMIN" };
const fetchMock = vi.fn<(url: URL | string, init: RequestInit) => Promise<Response>>();

function lastInit(): RequestInit {
  const call = fetchMock.mock.calls[0];
  if (call === undefined) throw new Error("fetch não chamado");
  return call[1];
}

beforeEach(() => {
  fetchMock.mockReset();
  redirect.mockClear();
  store.value = "tok";
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("PILLA_API_URL", "http://api.test:3001");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("getMe", () => {
  it("repassa o cookie de sessão", async () => {
    fetchMock.mockResolvedValue(Response.json(ADMIN));
    expect((await getMe()).username).toBe("joel");
    expect(new Headers(lastInit().headers).get("cookie")).toBe("pilla_session=tok");
  });

  it("sem sessão não manda cookie e devolve ApiProblem 401 (sem redirecionar)", async () => {
    store.value = undefined;
    fetchMock.mockResolvedValue(Response.json({}, { status: 401 }));
    await expect(getMe()).rejects.toBeInstanceOf(ApiProblem);
    expect(new Headers(lastInit().headers).get("cookie")).toBeNull();
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe("loginAdmin", () => {
  it("repassa o IP e devolve o token do Set-Cookie", async () => {
    const res = Response.json(ADMIN, { headers: { "set-cookie": "pilla_session=abc123; HttpOnly; Secure; Path=/" } });
    fetchMock.mockResolvedValue(res);
    const result = await loginAdmin({ username: "joel", password: "x" });
    expect(result.token).toBe("abc123");
    expect(new Headers(lastInit().headers).get("x-forwarded-for")).toBe("203.0.113.9");
  });

  it("401 vira ApiProblem", async () => {
    fetchMock.mockResolvedValue(new Response("não é json", { status: 401 }));
    await expect(loginAdmin({ username: "joel", password: "x" })).rejects.toMatchObject({ status: 401 });
  });

  it("sem cookie na resposta falha", async () => {
    fetchMock.mockResolvedValue(Response.json(ADMIN));
    await expect(loginAdmin({ username: "joel", password: "x" })).rejects.toBeInstanceOf(ApiProblem);
  });
});

describe("logoutAdmin", () => {
  it("chama a API com o cookie", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await logoutAdmin();
    expect(new Headers(lastInit().headers).get("cookie")).toBe("pilla_session=tok");
  });

  it("sem sessão não chama a API", async () => {
    store.value = undefined;
    await logoutAdmin();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("apiFetch com 401", () => {
  it("redireciona para /login", async () => {
    const { apiFetch } = await import("./client");
    const { z } = await import("zod");
    fetchMock.mockResolvedValue(Response.json({}, { status: 401 }));
    await expect(apiFetch({ path: "/x", schema: z.unknown() })).rejects.toThrow("redirect:/login");
  });
});
