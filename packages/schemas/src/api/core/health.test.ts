import { describe, expect, it } from "vitest";
import { healthResponseSchema } from "./health";

describe("healthResponseSchema", () => {
  it.each([
    { status: "ok", database: "up" },
    { status: "degraded", database: "down" },
  ])("aceita %j", (value) => {
    expect(healthResponseSchema.safeParse(value).success).toBe(true);
  });

  it.each([{}, { status: "ok" }, { status: "fail", database: "up" }, { status: "ok", database: "up", extra: 1 }, null])(
    "rejeita %j",
    (value) => {
      expect(healthResponseSchema.safeParse(value).success).toBe(false);
    },
  );
});
