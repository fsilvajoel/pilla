// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: () => Promise.resolve(store), headers: vi.fn() }));

import { clearSessionToken, readSessionToken, SESSION_COOKIE, writeSessionToken } from "./session";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("cookie de sessão", () => {
  it("lê o valor do cookie pilla_session", async () => {
    store.get.mockReturnValue({ name: SESSION_COOKIE, value: "tok" });
    expect(await readSessionToken()).toBe("tok");
    expect(store.get).toHaveBeenCalledWith("pilla_session");
  });

  it("sem cookie devolve undefined", async () => {
    store.get.mockReturnValue(undefined);
    expect(await readSessionToken()).toBeUndefined();
  });

  it("grava HttpOnly, Secure, Lax e Path=/ sem Max-Age", async () => {
    await writeSessionToken("abc");
    expect(store.set).toHaveBeenCalledWith("pilla_session", "abc", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
    });
  });

  it("clearSessionToken apaga o cookie", async () => {
    await clearSessionToken();
    expect(store.delete).toHaveBeenCalledWith("pilla_session");
  });
});
