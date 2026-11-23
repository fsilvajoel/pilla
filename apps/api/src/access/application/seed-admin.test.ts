import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migratedTestDb, type MigratedTestDb } from "../../db/test-db";
import { verifyPassword } from "../domain/password";
import { adminUsers } from "../infra/schema";
import { seedAdmin } from "./seed-admin";

// Senhas fictícias de teste.
const PASSWORD = "senha de teste um";
const OTHER_PASSWORD = "senha de teste dois";
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// Semeador do primeiro admin (E14 D9, PRD-001 RN-A05): cria ou redefine, com política de senha.
describe("seedAdmin (E14 D9)", () => {
  let test: MigratedTestDb;
  const rowsOf = (username: string) => test.db.select().from(adminUsers).where(eq(adminUsers.username, username));
  const count = async () => (await test.db.select().from(adminUsers)).length;
  beforeAll(async () => {
    test = await migratedTestDb();
  });
  afterAll(async () => test.close());

  it("creates an active admin with a uuid v7 id and an argon2id hash that verifies (A1, C1, C2)", async () => {
    const result = await seedAdmin(test.db, { username: "primeiro", password: PASSWORD });
    const [row] = await rowsOf("primeiro");
    expect(result).toBe("created");
    expect(row?.active).toBe(true);
    expect(row?.version).toBe(1);
    expect(row?.id).toMatch(UUID_V7);
    expect(row?.passwordHash).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword(row?.passwordHash ?? "", PASSWORD)).toBe(true);
    expect(await verifyPassword(row?.passwordHash ?? "", OTHER_PASSWORD)).toBe(false);
  });

  it("resets an existing inactive admin: new hash, active, version up, same id (A2, C3)", async () => {
    await seedAdmin(test.db, { username: "reset", password: PASSWORD });
    await test.db.update(adminUsers).set({ active: false }).where(eq(adminUsers.username, "reset"));
    const [before] = await rowsOf("reset");
    const result = await seedAdmin(test.db, { username: "reset", password: OTHER_PASSWORD });
    const [after] = await rowsOf("reset");
    expect(result).toBe("updated");
    expect(after?.id).toBe(before?.id);
    expect(after?.active).toBe(true);
    expect(after?.version).toBe((before?.version ?? 0) + 1);
    expect(await verifyPassword(after?.passwordHash ?? "", OTHER_PASSWORD)).toBe(true);
    expect(await verifyPassword(after?.passwordHash ?? "", PASSWORD)).toBe(false);
  });

  it("leaves the other admins untouched on a reset (A2, C4)", async () => {
    await seedAdmin(test.db, { username: "vizinho", password: PASSWORD });
    const [before] = await rowsOf("vizinho");
    await seedAdmin(test.db, { username: "reset", password: PASSWORD });
    const [after] = await rowsOf("vizinho");
    expect(after).toEqual(before);
  });

  it("accepts a password of exactly 12 and exactly 200 characters (A3, C5)", async () => {
    expect(await seedAdmin(test.db, { username: "min12", password: "a".repeat(12) })).toBe("created");
    expect(await seedAdmin(test.db, { username: "max200", password: "b".repeat(200) })).toBe("created");
  });

  it("rejects a password of 11 or 201 characters and writes nothing (A3, C6)", async () => {
    const before = await count();
    await expect(seedAdmin(test.db, { username: "curta", password: "a".repeat(11) })).rejects.toThrow();
    await expect(seedAdmin(test.db, { username: "longa", password: "a".repeat(201) })).rejects.toThrow();
    expect(await count()).toBe(before);
  });

  it("does not change an existing admin when the new password is rejected (A3, C6)", async () => {
    const [before] = await rowsOf("reset");
    await expect(seedAdmin(test.db, { username: "reset", password: "curta" })).rejects.toThrow();
    const [after] = await rowsOf("reset");
    expect(after).toEqual(before);
  });

  it("rejects an empty or blank username and one over 100 characters (A3, C7)", async () => {
    const before = await count();
    await expect(seedAdmin(test.db, { username: "", password: PASSWORD })).rejects.toThrow();
    await expect(seedAdmin(test.db, { username: "   ", password: PASSWORD })).rejects.toThrow();
    await expect(seedAdmin(test.db, { username: "u".repeat(101), password: PASSWORD })).rejects.toThrow();
    expect(await count()).toBe(before);
  });

  it("accepts a username of exactly 100 characters (A3, C7)", async () => {
    expect(await seedAdmin(test.db, { username: "u".repeat(100), password: PASSWORD })).toBe("created");
  });

  it("trims the username and treats the trimmed name as the same admin (A3, C8)", async () => {
    expect(await seedAdmin(test.db, { username: "  aparado  ", password: PASSWORD })).toBe("created");
    expect(await rowsOf("aparado")).toHaveLength(1);
    expect(await seedAdmin(test.db, { username: "aparado", password: OTHER_PASSWORD })).toBe("updated");
    expect(await rowsOf("  aparado  ")).toHaveLength(0);
  });

  it("never puts the password in an error message (A4, C9)", async () => {
    const shortPassword = "onze chars";
    const longPassword = "x".repeat(201);
    const messages: string[] = [];
    for (const [username, password] of [
      ["vazamento", shortPassword],
      ["vazamento", longPassword],
      ["", shortPassword],
      ["u".repeat(101), "senha de teste tres"],
    ] as const) {
      const error = await seedAdmin(test.db, { username, password }).then(
        () => undefined,
        (e: unknown) => e,
      );
      messages.push(error instanceof Error ? error.message : "sem erro");
      expect(error).toBeInstanceOf(Error);
    }
    for (const [message, secret] of [
      [messages[0], shortPassword],
      [messages[1], longPassword],
      [messages[2], shortPassword],
      [messages[3], "senha de teste tres"],
    ] as const) {
      expect(message).not.toContain(secret);
    }
  });
});
