import { describe, it, expect } from "vitest";
import { healthResponseSchema } from "./health";

describe("healthResponseSchema (A13)", () => {
  it("C29 (A13, unit): aceita os dois objetos válidos", () => {
    expect(healthResponseSchema.safeParse({ status: "ok", database: "up" }).success).toBe(true);
    expect(healthResponseSchema.safeParse({ status: "degraded", database: "down" }).success).toBe(true);
  });

  it("C30 (A13, unit): rejeita objetos inválidos", () => {
    const invalid = [
      {},
      { status: "ok" },
      { status: "fail", database: "up" },
      { status: "ok", database: "up", extra: 1 },
      null,
    ];
    for (const obj of invalid) {
      expect(healthResponseSchema.safeParse(obj).success).toBe(false);
    }
  });
});
