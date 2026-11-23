import { describe, expect, it } from "vitest";
import { newSessionToken, sessionIdOf } from "./session-token";

// E14-F01 (A7, A8), E14 D3: o cookie leva 32 bytes aleatórios em base64url; a tabela guarda só o SHA-256 em hex.
const base64url43 = /^[A-Za-z0-9_-]{43}$/;
// Vetor de teste do NIST (FIPS 180-2): SHA-256 de "abc".
const nistAbcDigest = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

describe("newSessionToken", () => {
  it("C11: returns 43 base64url characters that decode to 32 bytes", () => {
    const value = newSessionToken();
    expect(value).toMatch(base64url43);
    expect(Buffer.from(value, "base64url")).toHaveLength(32);
  });

  it("C12: two calls give different values", () => {
    expect(newSessionToken()).not.toBe(newSessionToken());
  });
});

describe("sessionIdOf", () => {
  it("C13: is the lowercase hex SHA-256 of the input", () => {
    expect(sessionIdOf("abc")).toBe(nistAbcDigest);
  });

  it("C13: has 64 lowercase hex characters and is stable for the same value", () => {
    const value = newSessionToken();
    const first = sessionIdOf(value);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(sessionIdOf(value)).toBe(first);
    expect(first).not.toBe(value);
  });

  it("C13: different values give different ids", () => {
    expect(sessionIdOf(newSessionToken())).not.toBe(sessionIdOf(newSessionToken()));
  });
});
