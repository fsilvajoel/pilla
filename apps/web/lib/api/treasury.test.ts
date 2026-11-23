// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiProblem } from "./problem";
import { createAccountEntry, getAccountStatement, listAccounts } from "./treasury";

const ID = "01890a5d-ac96-774b-bcce-b302099a8057";

const fetchMock = vi.fn<(url: URL, init: RequestInit) => Promise<Response>>();

function respond(body: unknown, status = 200): void {
  fetchMock.mockImplementation(() =>
    Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })),
  );
}

function last(): { url: string; init: RequestInit } {
  const call = fetchMock.mock.calls.at(-1);
  if (!call) throw new Error("fetch não chamado");
  return { url: call[0].toString(), init: call[1] };
}

beforeEach(() => {
  vi.stubEnv("PILLA_API_URL", "http://api.test");
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("treasury client", () => {
  it("listAccounts chama GET /accounts", async () => {
    respond({ items: [{ id: ID, name: "Caixa", active: true, balanceCents: 1000 }] });
    const res = await listAccounts();
    expect(last().url).toBe("http://api.test/accounts");
    expect(res.items[0]?.balanceCents).toBe(1000);
  });

  it("getAccountStatement monta a query e omite o que não foi informado", async () => {
    respond({
      accountId: ID,
      from: null,
      to: null,
      items: [],
      nextCursor: null,
      openingBalanceCents: 0,
      closingBalanceCents: 0,
    });
    await getAccountStatement(ID, { from: "2026-11-01", limit: 20, cursor: "abc" });
    expect(last().url).toBe(`http://api.test/accounts/${ID}/entries?from=2026-11-01&limit=20&cursor=abc`);
    await getAccountStatement(ID);
    expect(last().url).toBe(`http://api.test/accounts/${ID}/entries`);
  });

  it("createAccountEntry manda Idempotency-Key e corpo JSON", async () => {
    respond({ type: "x", title: "Inválido", status: 400, code: "VALIDATION_FAILED" }, 400);
    const err: unknown = await createAccountEntry(
      ID,
      { type: "CAPITAL_IN", amountCents: 5000, entryDate: "2026-11-20" },
      "chave-1",
    ).catch((e: unknown) => e);
    const { init, url } = last();
    expect(url).toBe(`http://api.test/accounts/${ID}/entries`);
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("idempotency-key")).toBe("chave-1");
    expect(err).toBeInstanceOf(ApiProblem);
  });
});
