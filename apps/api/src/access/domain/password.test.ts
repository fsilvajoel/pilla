import { describe, expect, it } from "vitest";
import { hashPassword, verifyAgainstDummy, verifyPassword } from "./password";

// E14-F01 (A3 a A6), E14 D2 e ADR-0011: argon2id com os parâmetros do OWASP (19 MiB, 2 iterações, paralelismo 1).
// Senhas fictícias, só de teste. Cada hash custa dezenas de ms: poucos casos.
const plain = "senha-ficticia-de-teste";
const encoded = /^\$argon2id\$v=19\$m=19456,t=2,p=1\$[A-Za-z0-9+/]+\$[A-Za-z0-9+/]+$/;
/** Sal: 5º campo do hash codificado ($argon2id$v=19$params$sal$hash). */
const saltOf = (hash: string): string | undefined => hash.split("$")[4];

describe("hashPassword", () => {
  it("C5: returns an argon2id encoded hash with m=19456, t=2, p=1", async () => {
    const hash = await hashPassword(plain);
    expect(hash).toMatch(encoded);
    expect(hash).not.toContain(plain);
  });

  it("C6: two hashes of the same password have different salts", async () => {
    const first = await hashPassword(plain);
    const second = await hashPassword(plain);
    expect(first).not.toBe(second);
    expect(saltOf(first)).not.toBe(saltOf(second));
  });
});

describe("verifyPassword", () => {
  it("C7: is true for the same password", async () => {
    const hash = await hashPassword(plain);
    await expect(verifyPassword(hash, plain)).resolves.toBe(true);
  });

  it("C8: is false for a wrong password", async () => {
    const hash = await hashPassword(plain);
    await expect(verifyPassword(hash, "senha-ficticia-errada")).resolves.toBe(false);
    await expect(verifyPassword(hash, "")).resolves.toBe(false);
  });

  it.each(["", "not-a-hash", "$argon2id$v=19$m=19456,t=2,p=1$", "$bcrypt$xyz"])(
    "C9: is false and does not throw for the malformed hash %j",
    async (malformed) => {
      await expect(verifyPassword(malformed, plain)).resolves.toBe(false);
    },
  );
});

describe("verifyAgainstDummy", () => {
  it("C10: is always false, whatever the password", async () => {
    await expect(verifyAgainstDummy(plain)).resolves.toBe(false);
    await expect(verifyAgainstDummy("")).resolves.toBe(false);
  });

  it("C10: runs a real verify (takes a comparable time to verifyPassword)", async () => {
    const hash = await hashPassword(plain);
    const realStart = performance.now();
    await verifyPassword(hash, "senha-ficticia-errada");
    const realMs = performance.now() - realStart;
    const dummyStart = performance.now();
    await verifyAgainstDummy("senha-ficticia-errada");
    const dummyMs = performance.now() - dummyStart;
    // D2: usuário inexistente custa o mesmo que senha errada; folga larga para não oscilar no CI.
    expect(dummyMs).toBeGreaterThan(realMs * 0.25);
  });
});
