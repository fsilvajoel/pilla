import { describe, it, expect } from "vitest";
import { ZodValidationPipe } from "./zod-validation.pipe";
import { z } from "zod";
import { ProblemException } from "./problem-exception";
import { fc } from "@fast-check/vitest";

const fixtureSchema = z.strictObject({
  name: z.string({ error: "Nome é obrigatório." }).min(1, "Nome é obrigatório."),
  age: z.number().int().min(0).max(150),
});

describe("ZodValidationPipe (A3)", () => {
  const pipe = new ZodValidationPipe(fixtureSchema);

  it("C8 (A3, unit): valor válido devolve saída do schema", () => {
    const input = { name: "Ana", age: 30 };
    const result = pipe.transform(input, { type: "body", metatype: undefined, data: "" });
    expect(result).toEqual(input);
  });

  it("C9 (A3, unit): objeto vazio lança VALIDATION_FAILED com errors por campo", () => {
    expect(() => pipe.transform({}, { type: "body", metatype: undefined, data: "" })).toThrow(ProblemException);
    try {
      pipe.transform({}, { type: "body", metatype: undefined, data: "" });
    } catch (e) {
      const ex = e as ProblemException;
      expect(ex.code).toBe("VALIDATION_FAILED");
      expect(ex.detail).toBe("Dados inválidos.");
      expect(ex.errors).toEqual([
        { field: "name", message: "Nome é obrigatório." },
        { field: "age", message: expect.any(String) as string },
      ]);
    }
  });

  it("C9 (A3, unit): name vazio aponta só name", () => {
    try {
      pipe.transform({ name: "", age: 30 }, { type: "body", metatype: undefined, data: "" });
    } catch (e) {
      const ex = e as ProblemException;
      expect(ex.errors).toEqual([{ field: "name", message: "Nome é obrigatório." }]);
    }
  });

  it("C10 (A3, unit): age inválido aponta age; campos extras, null, array apontam body", () => {
    const ageCases = [
      { input: { name: "Ana", age: 151 }, field: "age" },
      { input: { name: "Ana", age: -1 }, field: "age" },
      { input: { name: "Ana", age: "30" as unknown as number }, field: "age" },
    ];
    for (const { input, field } of ageCases) {
      try {
        pipe.transform(input, { type: "body", metatype: undefined, data: "" });
      } catch (e) {
        const ex = e as ProblemException;
        expect(ex.errors?.some((err) => err.field === field)).toBe(true);
      }
    }

    const rootCases = [{ name: "Ana", age: 30, role: "admin" }, null, []];
    for (const input of rootCases) {
      try {
        pipe.transform(input, { type: "body", metatype: undefined, data: "" });
      } catch (e) {
        const ex = e as ProblemException;
        expect(ex.errors?.some((err) => err.field === "body")).toBe(true);
      }
    }

    // query type
    try {
      pipe.transform({ name: "Ana", age: 151 }, { type: "query", metatype: undefined, data: "" });
    } catch (e) {
      const ex = e as ProblemException;
      expect(ex.errors?.some((err) => err.field === "age")).toBe(true);
    }
  });

  it("C11 (A3, prop): para qualquer valor, devolve saída ou lança ProblemException com errors sem field repetido e message não vazio", () => {
    fc.assert(
      fc.property(fc.anything(), (value) => {
        try {
          const result = pipe.transform(value, { type: "body", metatype: undefined, data: "" });
          fixtureSchema.parse(result);
        } catch (e) {
          const ex = e as ProblemException;
          expect(ex.code).toBe("VALIDATION_FAILED");
          expect(Array.isArray(ex.errors)).toBe(true);
          if (ex.errors) {
            const fields = ex.errors.map((err) => err.field);
            expect(new Set(fields).size).toBe(fields.length);
            for (const err of ex.errors) {
              expect(err.message.length).toBeGreaterThan(0);
            }
          }
        }
      }),
    );
  });

  it("C11b (A3, unit): vários problemas no mesmo caminho geram um só item, com a primeira mensagem", () => {
    const multiPipe = new ZodValidationPipe(
      z.strictObject({ code: z.string().min(3, "Curto demais.").regex(/^\d+$/, "Só dígitos.") }),
    );
    let thrown: unknown;
    try {
      multiPipe.transform({ code: "a" }, { type: "body", metatype: undefined, data: "" });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(ProblemException);
    expect((thrown as ProblemException).errors).toEqual([{ field: "code", message: "Curto demais." }]);
  });
});
