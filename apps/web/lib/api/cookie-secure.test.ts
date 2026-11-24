import { afterEach, describe, expect, it, vi } from "vitest";
import { cookieSecure } from "./cookie-secure";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("cookieSecure", () => {
  it("é verdadeiro por padrão e com qualquer valor que não seja false", () => {
    vi.stubEnv("PILLA_COOKIE_SECURE", undefined);
    expect(cookieSecure()).toBe(true);
    vi.stubEnv("PILLA_COOKIE_SECURE", "true");
    expect(cookieSecure()).toBe(true);
    vi.stubEnv("PILLA_COOKIE_SECURE", "");
    expect(cookieSecure()).toBe(true);
  });

  it("é falso só com PILLA_COOKIE_SECURE=false", () => {
    vi.stubEnv("PILLA_COOKIE_SECURE", "false");
    expect(cookieSecure()).toBe(false);
  });
});
