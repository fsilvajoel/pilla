// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDefaultTerms, updateDefaultTerms } from "./settings";

const terms = {
  lateFeeBps: 200,
  lateInterestMonthlyBps: 100,
  gracePeriodDays: 0,
  suggestedMonthlyRateBps: 500,
  roundingStepCents: 500,
};

const fetchMock = vi.fn<(url: URL, init: RequestInit) => Promise<Response>>();

beforeEach(() => {
  vi.stubEnv("PILLA_API_URL", "http://api.test");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockImplementation(() => Promise.resolve(new Response(JSON.stringify(terms), { status: 200 })));
});
afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("settings client", () => {
  it("getDefaultTerms lê GET /settings/default-terms", async () => {
    expect(await getDefaultTerms()).toEqual(terms);
    expect(fetchMock.mock.calls[0]?.[0].toString()).toBe("http://api.test/settings/default-terms");
  });

  it("updateDefaultTerms manda PUT com o corpo inteiro", async () => {
    await updateDefaultTerms(terms);
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe("PUT");
    expect(init?.body).toBe(JSON.stringify(terms));
  });
});
