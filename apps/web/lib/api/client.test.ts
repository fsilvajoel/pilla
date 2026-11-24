// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { apiFetch } from "./client";
import { ApiProblem } from "./problem";

const schema = z.strictObject({ ok: z.boolean() });

function jsonResponse(body: string, status = 200): Response {
  return new Response(body, { status, headers: { "content-type": "application/json" } });
}

interface Call {
  url: URL;
  init: RequestInit;
}

function lastCall(fetchMock: ReturnType<typeof vi.fn>): Call {
  const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
  return { url, init };
}

describe("apiFetch", () => {
  const fetchMock = vi.fn<(url: URL, init: RequestInit) => Promise<Response>>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("PILLA_API_URL", "http://api.test:3001/");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("GET: monta a URL sem barra dupla, omite query vazia/indefinida e não manda corpo", async () => {
    fetchMock.mockResolvedValue(jsonResponse('{"ok":true}'));
    const result = await apiFetch({
      path: "/people",
      query: { search: "ana", limit: 10, cursor: undefined, empty: "" },
      schema,
    });
    expect(result).toEqual({ ok: true });
    const { url, init } = lastCall(fetchMock);
    expect(url.toString()).toBe("http://api.test:3001/people?search=ana&limit=10");
    expect(init.method).toBe("GET");
    expect(init.body).toBeNull();
    expect(init.cache).toBe("no-store");
    expect(init.headers).toEqual({ accept: "application/json, application/problem+json" });
  });

  it("POST: manda corpo JSON e content-type", async () => {
    fetchMock.mockResolvedValue(jsonResponse('{"ok":true}', 201));
    await apiFetch({ method: "POST", path: "/people", body: { fullName: "Ana" }, schema });
    const { url, init } = lastCall(fetchMock);
    expect(url.toString()).toBe("http://api.test:3001/people");
    expect(init.method).toBe("POST");
    expect(init.body).toBe('{"fullName":"Ana"}');
    expect(init.headers).toEqual({
      accept: "application/json, application/problem+json",
      "content-type": "application/json",
    });
  });

  it("resposta vazia é lida como null (schema z.null)", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 200 }));
    const result = await apiFetch({ method: "DELETE", path: "/addresses/1", schema: z.null() });
    expect(result).toBeNull();
    expect(lastCall(fetchMock).init.method).toBe("DELETE");
  });

  it("erro com problem+json lança ApiProblem com status, code e campos", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        JSON.stringify({
          title: "Dados inválidos",
          status: 400,
          detail: "Há campos inválidos",
          code: "VALIDATION_FAILED",
          errors: [{ field: "cpf", message: "CPF inválido" }],
        }),
        400,
      ),
    );
    const err: unknown = await apiFetch({ path: "/people", schema }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiProblem);
    const problem = err as ApiProblem;
    expect(problem.status).toBe(400);
    expect(problem.code).toBe("VALIDATION_FAILED");
    expect(problem.message).toBe("Há campos inválidos");
    expect(problem.fieldMessages()).toEqual({ cpf: "CPF inválido" });
  });

  it("erro com corpo que não é JSON lança ApiProblem genérico", async () => {
    fetchMock.mockResolvedValue(new Response("<html>Bad Gateway</html>", { status: 502 }));
    const err: unknown = await apiFetch({ path: "/people", schema }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiProblem);
    const problem = err as ApiProblem;
    expect(problem.status).toBe(502);
    expect(problem.code).toBeNull();
    expect(problem.message).toBe("Falha na API (HTTP 502)");
  });

  it("sucesso com resposta fora do schema lança ApiProblem com o status", async () => {
    fetchMock.mockResolvedValue(jsonResponse('{"ok":"sim"}'));
    const err: unknown = await apiFetch({ path: "/people", schema }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiProblem);
    expect((err as ApiProblem).status).toBe(200);
    expect((err as ApiProblem).code).toBeNull();
  });

  it("sem PILLA_API_URL lança erro e não chama fetch", async () => {
    vi.stubEnv("PILLA_API_URL", "");
    await expect(apiFetch({ path: "/people", schema })).rejects.toThrow("PILLA_API_URL não definida");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("401 com autenticação ligada redireciona para /login", async () => {
    fetchMock.mockResolvedValue(jsonResponse("{}", 401));
    await expect(apiFetch({ path: "/people", schema })).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT") as string,
    });
  });

  it("401 com PILLA_AUTH_ENFORCED=false não redireciona: devolve o problema", async () => {
    vi.stubEnv("PILLA_AUTH_ENFORCED", "false");
    fetchMock.mockResolvedValue(jsonResponse("{}", 401));
    await expect(apiFetch({ path: "/people", schema })).rejects.toBeInstanceOf(ApiProblem);
  });
});
