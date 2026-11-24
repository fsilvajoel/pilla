// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const client = vi.hoisted(() => ({ apiFetch: vi.fn() }));
vi.mock("./client", () => client);

import { getPortalAccess, portalAccessResponse, setPortalAccess } from "./portal-access";

const ID = "01890a5d-ac96-774b-bcce-b302099a8057";

beforeEach(() => {
  client.apiFetch.mockReset();
  client.apiFetch.mockResolvedValue({ personId: ID, enabled: true, enabledAt: null });
});

describe("portal-access client", () => {
  it("getPortalAccess faz GET /portal-access/{id}", async () => {
    expect((await getPortalAccess(ID)).enabled).toBe(true);
    expect(client.apiFetch).toHaveBeenCalledWith({ path: `/portal-access/${ID}`, schema: portalAccessResponse });
  });

  it("setPortalAccess faz PUT com {enabled}", async () => {
    await setPortalAccess(ID, false);
    expect(client.apiFetch).toHaveBeenCalledWith({
      method: "PUT",
      path: `/portal-access/${ID}`,
      body: { enabled: false },
      schema: portalAccessResponse,
    });
  });

  it("o schema da resposta aceita data nula e recusa campo extra", () => {
    expect(portalAccessResponse.safeParse({ personId: ID, enabled: false, enabledAt: null }).success).toBe(true);
    expect(portalAccessResponse.safeParse({ personId: ID, enabled: false, enabledAt: null, x: 1 }).success).toBe(false);
  });
});
