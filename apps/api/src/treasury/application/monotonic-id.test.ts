import { describe, expect, it } from "vitest";
import { nextId } from "./monotonic-id";

describe("nextId", () => {
  it("returns increasing ids even when the clock does not move", () => {
    const ids = [nextId(1_000), nextId(1_000), nextId(500)];
    expect([...ids].sort()).toEqual(ids);
    expect(new Set(ids).size).toBe(3);
  });

  it("follows a clock that moves forward", () => {
    const first = nextId(2_000_000);
    const later = nextId(3_000_000);
    expect(later > first).toBe(true);
  });

  it("uses the current clock by default", () => {
    expect(nextId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-/);
  });
});
