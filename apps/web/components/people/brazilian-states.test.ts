import { describe, expect, it } from "vitest";
import { brazilianStates } from "./brazilian-states";

describe("brazilianStates", () => {
  it("lista as 27 unidades da federação sem repetir sigla", () => {
    expect(brazilianStates).toHaveLength(27);
    expect(new Set(brazilianStates.map((s) => s.code)).size).toBe(27);
  });

  it("traz sigla de 2 letras e nome para cada estado", () => {
    for (const state of brazilianStates) {
      expect(state.code).toMatch(/^[A-Z]{2}$/);
      expect(state.name.length).toBeGreaterThan(0);
    }
  });
});
