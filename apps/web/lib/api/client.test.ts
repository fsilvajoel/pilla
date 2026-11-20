// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { apiFetch } from "./client";
import { ApiProblem } from "./problem";

const okSchema = z.strictObject({ ok: z.boolean() });

function respond(status: number, body: string): Response {
  return new Response(status === 204 ? null : body, { status });
}

describe("apiFetch", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubEnv("PILLA_API_URL", "http://api.test/api/v1/");
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("calls the API with the query string, skipping empty values, and validates the answer", async () => {
    fetchMock.mockResolvedValue(respond(200, '{"ok":true}'));

    const result = await apiFetch({
      path: "/people",
      query: { search: "ana", limit: 20, cursor: "", other: undefined },
      schema: okSchema,
    });

    expect(result).toEqual({ ok: true });
    const call = fetchMock.mock.calls[0];
    expect(call?.[0]).toBeInstanceOf(URL);
    expect(call?.[0] instanceof URL ? call[0].href : "").toBe("http://api.test/api/v1/people?search=ana&limit=20");
    expect(call?.[1]).toMatchObject({ method: "GET", body: null, cache: "no-store" });
  });

  it("sends a JSON body with the content type", async () => {
    fetchMock.mockResolvedValue(respond(200, '{"ok":true}'));

    await apiFetch({ method: "POST", path: "/people", body: { a: 1 }, schema: okSchema });

    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.body).toBe('{"a":1}');
    expect(init?.headers).toMatchObject({ "content-type": "application/json" });
  });

  it("turns a problem+json answer into an ApiProblem", async () => {
    fetchMock.mockResolvedValue(
      respond(409, '{"title":"Conflito","status":409,"detail":"CPF já cadastrado.","code":"DUPLICATE_CPF"}'),
    );

    await expect(apiFetch({ path: "/people", schema: okSchema })).rejects.toMatchObject({
      status: 409,
      code: "DUPLICATE_CPF",
    });
  });

  it("turns an error with an unreadable body into a generic ApiProblem", async () => {
    fetchMock.mockResolvedValue(respond(500, "not json"));

    const error = await apiFetch({ path: "/people", schema: okSchema }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiProblem);
    expect(error).toMatchObject({ status: 500, code: null });
  });

  it("accepts an empty successful body when the schema allows null", async () => {
    fetchMock.mockResolvedValue(respond(204, ""));

    expect(await apiFetch({ method: "DELETE", path: "/addresses/x", schema: z.null() })).toBeNull();
  });

  it("rejects a successful answer that does not match the schema", async () => {
    fetchMock.mockResolvedValue(respond(200, '{"ok":"yes"}'));

    await expect(apiFetch({ path: "/people", schema: okSchema })).rejects.toMatchObject({ status: 200, code: null });
  });

  it("fails when PILLA_API_URL is not set", async () => {
    vi.stubEnv("PILLA_API_URL", "");

    await expect(apiFetch({ path: "/people", schema: okSchema })).rejects.toThrow("PILLA_API_URL não definida");
  });
});
