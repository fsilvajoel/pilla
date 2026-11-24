import { describe, expect, it } from "vitest";
import { adminMeResponse } from "./admin-me";

// E14-F01 (A1, A2): resposta de GET /auth/admin/me e do login (RFC-004 §3, ADR-0011). Id fictício em UUID v7.
const valid = { id: "01936f8e-7b2c-7cde-8f00-000000000001", username: "admin", role: "ADMIN" };

describe("adminMeResponse", () => {
  it("C1: accepts id uuid, username and role ADMIN", () => {
    const parsed = adminMeResponse.safeParse(valid);
    expect(parsed.success).toBe(true);
    expect(parsed.data).toEqual(valid);
  });

  it("C1: accepts a username of exactly 100 characters", () => {
    expect(adminMeResponse.safeParse({ ...valid, username: "a".repeat(100) }).success).toBe(true);
  });

  it("C2: rejects an extra key", () => {
    expect(adminMeResponse.safeParse({ ...valid, passwordHash: "x" }).success).toBe(false);
  });

  it.each(["CLIENT", "admin", ""])("C3: rejects role %j", (role) => {
    expect(adminMeResponse.safeParse({ ...valid, role }).success).toBe(false);
  });

  it.each(["not-a-uuid", "", "01936f8e7b2c7cde8f00000000000001"])("C4: rejects id %j", (id) => {
    expect(adminMeResponse.safeParse({ ...valid, id }).success).toBe(false);
  });

  it("C4: rejects an empty username and one with 101 characters", () => {
    expect(adminMeResponse.safeParse({ ...valid, username: "" }).success).toBe(false);
    expect(adminMeResponse.safeParse({ ...valid, username: "a".repeat(101) }).success).toBe(false);
  });

  it("C4: rejects a body without one of the required keys", () => {
    expect(adminMeResponse.safeParse({ id: valid.id, username: valid.username }).success).toBe(false);
    expect(adminMeResponse.safeParse({ username: valid.username, role: valid.role }).success).toBe(false);
  });
});
