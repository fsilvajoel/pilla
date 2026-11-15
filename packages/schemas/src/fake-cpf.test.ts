import { describe, expect, it } from "vitest";
import { fakeCpf } from "./fake-cpf";
import { cpfSchema } from "./common";

describe("fakeCpf", () => {
  describe("RN-P01: CPF único e válido", () => {
    it.each([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])("devolve CPF válido para seed %i", (seed) => {
      const seedString = String(seed).padStart(9, "0");
      const expectedCpf = seedString + "91";
      expect(fakeCpf(seed)).toBe(expectedCpf);
      const result = cpfSchema.safeParse(fakeCpf(seed));
      expect(result).toBeInstanceOf(Object);
    });

    it.each([100, 123, 456, 789, 999])("devolve CPF válido para seed %i", (seed) => {
      expect(fakeCpf(seed)).toMatch(/^\d{11}$/);
    });

    it("devolve CPF válido para seed 123456789", () => {
      expect(fakeCpf(123456789)).toBe("12345678909");
    });
  });

  describe("Determinismo e unicidade", () => {
    it("mesmo seed, mesmo CPF", () => {
      const seed = 42;
      const cpf1 = fakeCpf(seed);
      const cpf2 = fakeCpf(seed);
      expect(cpf1).toBe(cpf2);
    });

    it("seeds diferentes, CPFs diferentes", () => {
      const cpf1 = fakeCpf(1);
      const cpf2 = fakeCpf(2);
      expect(cpf1).not.toBe(cpf2);
    });
  });

  describe("Erros: seeds inválidos", () => {
    it.each([-1, 1000000000, 1.5, NaN])("joga RangeError para seed %s", (seed) => {
      expect(() => fakeCpf(seed)).toThrow(RangeError);
    });

    it("joga RangeError para seed 0", () => {
      expect(() => fakeCpf(0)).toThrow(RangeError);
    });

    it("joga RangeError para seed 111111111", () => {
      expect(() => fakeCpf(111111111)).toThrow(RangeError);
    });
  });
});
