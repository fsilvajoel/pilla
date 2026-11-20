import { describe, it, expect } from "vitest";
import { REDACTED, redact } from "./redact";

const SENSITIVE_KEYS = [
  "cpf",
  "phone",
  "email",
  "password",
  "token",
  "accessToken",
  "ownerCpf",
  "userEmail",
  "PASSWORD",
] as const;

const NON_SENSITIVE_KEYS = ["name", "amountCents", "id"] as const;

describe("redact", () => {
  describe.each(SENSITIVE_KEYS)("C1,C2: key %s is redacted", (key) => {
    it("replaces value with REDACTED", () => {
      const input = { [key]: "x", name: "Ana" };
      const result = redact(input);
      expect(result).toEqual({ [key]: REDACTED, name: "Ana" });
    });
  });

  describe.each(NON_SENSITIVE_KEYS)("C3: key %s keeps its value", (key) => {
    it("returns the same value", () => {
      const input = { [key]: "x", cpf: "y" };
      const result = redact(input);
      expect(result).toEqual({ [key]: "x", cpf: REDACTED });
    });
  });

  describe("C4: nested objects", () => {
    it("redacts sensitive keys at any depth", () => {
      const input = { user: { profile: { cpf: "x", name: "Ana" } } };
      const result = redact(input);
      expect(result).toEqual({ user: { profile: { cpf: REDACTED, name: "Ana" } } });
    });
  });

  describe("C5: objects inside arrays", () => {
    it("redacts sensitive keys in each array element", () => {
      const input = { items: [{ email: "x" }, { phone: "y" }, { name: "Ana" }] };
      const result = redact(input);
      expect(result).toEqual({ items: [{ email: REDACTED }, { phone: REDACTED }, { name: "Ana" }] });
    });
  });

  describe("C6: input is not mutated", () => {
    it("returns a new object and leaves the original intact, including nested arrays", () => {
      const input = { data: [{ cpf: "x" }], token: "y" };
      const cloned = structuredClone(input);
      redact(input);
      expect(input).toEqual(cloned);
    });
  });

  describe("C7: non-plain-object values are returned as they came", () => {
    it.each([
      { name: "Date", value: new Date("2024-01-01T00:00:00.000Z") },
      { name: "Error", value: new Error("fail") },
      { name: "string", value: "text" },
      { name: "number", value: 42 },
      { name: "null", value: null },
    ])("$name is returned by reference", ({ value }) => {
      const result = redact(value);
      expect(result).toBe(value);
    });
  });

  describe("C8: object without prototype is treated as plain object", () => {
    it("redacts sensitive keys in an object with null prototype", () => {
      const input = { cpf: "x", name: "Ana" };
      Object.setPrototypeOf(input, null);
      const result = redact(input);
      expect(result).toEqual({ cpf: REDACTED, name: "Ana" });
    });
  });
});
