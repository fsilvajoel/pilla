// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parsePortalSetCookie } from "./portal";

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
