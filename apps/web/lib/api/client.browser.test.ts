import { describe, expect, it } from "vitest";

describe("lib/api/client in the browser", () => {
  it("refuses to load where `window` exists (the browser never calls the API directly, ADR-0013)", async () => {
    await expect(import("./client")).rejects.toThrow("lib/api/client só pode ser usado no servidor");
  });
});
