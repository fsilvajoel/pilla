import { describe, it, expect } from "vitest";
import { REDACTED, redact } from "./redact";

describe("redact prototype", () => {
  describe("C9: plain object with own constructor key", () => {
    it("redacts sensitive keys and keeps constructor and name keys", () => {
      const input = { constructor: "x", cpf: "123", name: "Ana" };
      const result = redact(input);
      expect(result).toEqual({ constructor: "x", cpf: REDACTED, name: "Ana" });
    });
  });

  describe("C10: same object nested inside another object and inside an array", () => {
    it("redacts sensitive keys in nested object", () => {
      const input = { outer: { constructor: "x", cpf: "123", name: "Ana" } };
      const result = redact(input);
      expect(result).toEqual({ outer: { constructor: "x", cpf: REDACTED, name: "Ana" } });
    });

    it("redacts sensitive keys in object inside array", () => {
      const input = { items: [{ constructor: "x", cpf: "123", name: "Ana" }] };
      const result = redact(input);
      expect(result).toEqual({ items: [{ constructor: "x", cpf: REDACTED, name: "Ana" }] });
    });
  });
});
