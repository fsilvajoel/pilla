// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addAddress,
  addPixKey,
  createPerson,
  deleteAddress,
  deletePixKey,
  getPerson,
  listPeople,
  updateAddress,
  updatePerson,
  updatePixKey,
} from "./people";
import { ApiProblem } from "./problem";

const ID = "01890a5d-ac96-774b-bcce-b302099a8057";
const ID2 = "01890a5d-ac96-774b-bcce-b302099a8058";
const CPF = "52998224725";

const address = {
  id: ID,
  street: "Rua A",
  number: "10",
  district: "Centro",
  city: "São Paulo",
  state: "SP",
  postalCode: "01001000",
  isPrimary: true,
};
const pixKey = { id: ID, type: "EMAIL", value: "a@b.com", isPrimary: false };
const summary = { id: ID, fullName: "Ana", cpf: CPF, phone: "+5511987654321", active: true };
const detail = {
  id: ID,
  fullName: "Ana",
  cpf: CPF,
  phone: "+5511987654321",
  active: true,
  version: 1,
  referrer: null,
  referrals: [summary],
  addresses: [address],
  pixKeys: [pixKey],
};

const created = { id: ID, fullName: "Ana", cpf: CPF, phone: "+5511987654321", active: true, version: 1 };

function ok(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("lib/api/people", () => {
  const fetchMock = vi.fn<(url: URL, init: RequestInit) => Promise<Response>>();

  function call(): { url: string; init: RequestInit } {
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    return { url: url.toString(), init };
  }

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("PILLA_API_URL", "http://api.test");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("listPeople: GET /people com query só dos parâmetros presentes", async () => {
    fetchMock.mockResolvedValue(ok({ items: [{ ...summary, cpf: null }], nextCursor: null }));
    const result = await listPeople({ search: "ana", limit: 20 });
    expect(result.items[0]?.cpf).toBeNull();
    expect(result.nextCursor).toBeNull();
    const { url, init } = call();
    expect(url).toBe("http://api.test/people?search=ana&limit=20");
    expect(init.method).toBe("GET");
    expect(init.body).toBeNull();
  });

  it("listPeople: sem parâmetros chama /people puro", async () => {
    fetchMock.mockResolvedValue(ok({ items: [], nextCursor: "abc" }));
    const result = await listPeople();
    expect(result).toEqual({ items: [], nextCursor: "abc" });
    expect(call().url).toBe("http://api.test/people");
  });

  it("getPerson: GET /people/{id}", async () => {
    fetchMock.mockResolvedValue(ok(detail));
    const result = await getPerson(ID);
    expect(result.fullName).toBe("Ana");
    expect(result.addresses).toEqual([address]);
    expect(call().url).toBe(`http://api.test/people/${ID}`);
    expect(call().init.method).toBe("GET");
  });

  it("getPerson: 404 problem+json vira ApiProblem NOT_FOUND", async () => {
    fetchMock.mockResolvedValue(
      ok({ title: "Não encontrado", status: 404, detail: "Pessoa não encontrada", code: "NOT_FOUND" }, 404),
    );
    const err: unknown = await getPerson(ID).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiProblem);
    expect((err as ApiProblem).status).toBe(404);
    expect((err as ApiProblem).code).toBe("NOT_FOUND");
  });

  it("createPerson: POST /people com corpo JSON", async () => {
    fetchMock.mockResolvedValue(ok(created, 201));
    const body = { fullName: "Ana", cpf: CPF, phone: "+5511987654321" };
    await createPerson(body);
    const { url, init } = call();
    expect(url).toBe("http://api.test/people");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify(body));
  });

  it("updatePerson: PATCH /people/{id}", async () => {
    fetchMock.mockResolvedValue(ok(created));
    await updatePerson(ID, { fullName: "Ana B", version: 1 });
    const { url, init } = call();
    expect(url).toBe(`http://api.test/people/${ID}`);
    expect(init.method).toBe("PATCH");
    expect(init.body).toBe('{"fullName":"Ana B","version":1}');
  });

  it("addAddress: POST /people/{id}/addresses", async () => {
    fetchMock.mockResolvedValue(ok(address, 201));
    const body = {
      street: "Rua A",
      number: "10",
      district: "Centro",
      city: "São Paulo",
      state: "SP",
      postalCode: "01001000",
      isPrimary: true,
    };
    const result = await addAddress(ID2, body);
    expect(result).toEqual(address);
    expect(call().url).toBe(`http://api.test/people/${ID2}/addresses`);
    expect(call().init.method).toBe("POST");
    expect(call().init.body).toBe(JSON.stringify(body));
  });

  it("updateAddress: PATCH /addresses/{id}", async () => {
    fetchMock.mockResolvedValue(ok(address));
    await updateAddress(ID, { city: "Santos" });
    expect(call().url).toBe(`http://api.test/addresses/${ID}`);
    expect(call().init.method).toBe("PATCH");
    expect(call().init.body).toBe('{"city":"Santos"}');
  });

  it("deleteAddress: DELETE /addresses/{id} com resposta vazia", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const result = await deleteAddress(ID);
    expect(result).toBeNull();
    expect(call().url).toBe(`http://api.test/addresses/${ID}`);
    expect(call().init.method).toBe("DELETE");
    expect(call().init.body).toBeNull();
  });

  it("addPixKey: POST /people/{id}/pix-keys", async () => {
    fetchMock.mockResolvedValue(ok(pixKey, 201));
    const result = await addPixKey(ID2, { type: "EMAIL", value: "a@b.com" });
    expect(result).toEqual(pixKey);
    expect(call().url).toBe(`http://api.test/people/${ID2}/pix-keys`);
    expect(call().init.method).toBe("POST");
    expect(call().init.body).toBe('{"type":"EMAIL","value":"a@b.com"}');
  });

  it("updatePixKey: PATCH /pix-keys/{id}", async () => {
    fetchMock.mockResolvedValue(ok(pixKey));
    await updatePixKey(ID, { isPrimary: true });
    expect(call().url).toBe(`http://api.test/pix-keys/${ID}`);
    expect(call().init.method).toBe("PATCH");
    expect(call().init.body).toBe('{"isPrimary":true}');
  });

  it("deletePixKey: DELETE /pix-keys/{id}", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    expect(await deletePixKey(ID)).toBeNull();
    expect(call().url).toBe(`http://api.test/pix-keys/${ID}`);
    expect(call().init.method).toBe("DELETE");
  });
});
