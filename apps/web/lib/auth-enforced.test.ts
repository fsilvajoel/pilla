import { afterEach, describe, expect, it, vi } from "vitest";
import { authEnforced } from "./auth-enforced";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("authEnforced", () => {
  it("é verdadeiro por padrão e com qualquer valor que não seja false", () => {
    vi.stubEnv("PILLA_AUTH_ENFORCED", undefined);
    expect(authEnforced()).toBe(true);
    vi.stubEnv("PILLA_AUTH_ENFORCED", "true");
    expect(authEnforced()).toBe(true);
  });

  it("é falso só com false", () => {
    vi.stubEnv("PILLA_AUTH_ENFORCED", "false");
    expect(authEnforced()).toBe(false);
  });
});
