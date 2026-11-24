// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiProblem } from "./problem";
import {
  createPortalSession,
  deletePortalSession,
  getPortalLoan,
  getPortalLoans,
  parsePortalSetCookie,
} from "./portal";

const ID = "01890a5d-ac96-774b-bcce-b302099a8057";
const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>();

function respond(
  body: string | null,
  status = 200,
  headers: HeadersInit = { "content-type": "application/json" },
): void {
  fetchMock.mockImplementation(() => Promise.resolve(new Response(body, { status, headers })));
}

function last(): { url: string; init: RequestInit } {
  const call = fetchMock.mock.calls.at(-1);
  if (!call) throw new Error("fetch não chamado");
  return { url: call[0], init: call[1] };
}

beforeEach(() => {
  vi.stubEnv("PILLA_API_URL", "http://api.test/");
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("parsePortalSetCookie", () => {
  it("lê o token e o Max-Age do cookie do portal", () => {
    const cookie = parsePortalSetCookie([
      "outro=1; Path=/",
      "pilla_portal=abc123; Max-Age=1800; Path=/api/v1/portal; HttpOnly; Secure; SameSite=Lax",
    ]);
    expect(cookie).toEqual({ token: "abc123", maxAgeSeconds: 1800 });
  });

  it("usa o teto de 2 horas sem Max-Age e devolve nulo sem o cookie", () => {
    expect(parsePortalSetCookie(["pilla_portal=xyz; Path=/"])).toEqual({ token: "xyz", maxAgeSeconds: 7200 });
    expect(parsePortalSetCookie(["outro=1"])).toBeNull();
  });
});

describe("createPortalSession", () => {
  it("POST /portal/session com o CPF e devolve o cookie emitido pela API", async () => {
    const headers = new Headers({ "set-cookie": "pilla_portal=tok; Max-Age=900; Path=/api/v1/portal; HttpOnly" });
    fetchMock.mockImplementation(() => Promise.resolve(new Response(null, { status: 204, headers })));
    expect(await createPortalSession("52998224725")).toEqual({ token: "tok", maxAgeSeconds: 900 });
    const { url, init } = last();
    expect(url).toBe("http://api.test/portal/session");
    expect(init.method).toBe("POST");
    expect(init.body).toBe('{"cpf":"52998224725"}');
    expect(init.headers).toMatchObject({ "content-type": "application/json" });
  });

  it("sem Set-Cookie do portal vira erro 500", async () => {
    respond(null, 204, {});
    const error: unknown = await createPortalSession("52998224725").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiProblem);
    expect((error as ApiProblem).status).toBe(500);
  });

  it("401 da API chega como ApiProblem", async () => {
    respond('{"title":"Não autorizado","status":401,"code":"UNAUTHENTICATED"}', 401);
    const error: unknown = await createPortalSession("52998224725").catch((e: unknown) => e);
    expect((error as ApiProblem).status).toBe(401);
  });

  it("recusa CPF inválido antes de chamar a API", async () => {
    await expect(createPortalSession("123")).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sem PILLA_API_URL falha", async () => {
    vi.stubEnv("PILLA_API_URL", "");
    await expect(createPortalSession("52998224725")).rejects.toThrow("PILLA_API_URL");
  });
});

describe("deletePortalSession", () => {
  it("DELETE repassa o cookie do portal quando há token e não manda quando não há", async () => {
    respond(null, 204, {});
    await deletePortalSession("tok");
    expect(last().init.method).toBe("DELETE");
    expect(last().init.headers).toMatchObject({ cookie: "pilla_portal=tok" });
    await deletePortalSession(undefined);
    expect(last().init.headers).not.toHaveProperty("cookie");
  });
});

describe("getPortalLoans e getPortalLoan", () => {
  it("lista os contratos com o cookie e valida a resposta", async () => {
    respond(
      JSON.stringify({
        items: [
          {
            id: ID,
            loanNumber: "2026-0001",
            principalCents: 1000,
            outstandingCents: 500,
            situation: "CURRENT",
            nextDueDate: "2026-12-01",
          },
        ],
      }),
    );
    const res = await getPortalLoans("tok");
    expect(res.items[0]?.situation).toBe("CURRENT");
    expect(last().url).toBe("http://api.test/portal/loans");
    expect(last().init.headers).toMatchObject({ cookie: "pilla_portal=tok" });
  });

  it("resposta fora do schema vira ApiProblem 500; corpo não JSON também", async () => {
    respond('{"items":[{"x":1}]}');
    expect(await getPortalLoans("tok").catch((e: unknown) => e)).toBeInstanceOf(ApiProblem);
    respond("não é json");
    expect(await getPortalLoans("tok").catch((e: unknown) => e)).toBeInstanceOf(ApiProblem);
  });

  it("detalhe codifica o id na URL e devolve o contrato", async () => {
    respond(
      JSON.stringify({
        id: ID,
        loanNumber: "2026-0001",
        situation: "PAID_OFF",
        principalCents: 1000,
        totalCents: 1100,
        paidCents: 1100,
        outstandingCents: 0,
        lateChargesCents: 0,
        nextInstallment: null,
        installments: [],
        payments: [],
      }),
    );
    expect((await getPortalLoan("tok", ID)).situation).toBe("PAID_OFF");
    expect(last().url).toBe(`http://api.test/portal/loans/${ID}`);
    respond('{"title":"Não encontrado","status":404,"code":"NOT_FOUND"}', 404);
    const error: unknown = await getPortalLoan("tok", "a/b").catch((e: unknown) => e);
    expect((error as ApiProblem).status).toBe(404);
    expect(last().url).toBe("http://api.test/portal/loans/a%2Fb");
  });
});
