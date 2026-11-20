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

  const bodyMeta = { type: "body", metatype: undefined, data: "" } as const;

  // Executa o pipe e devolve a ProblemException lançada; falha se nada for lançado.
  function thrownBy(value: unknown, type: "body" | "query" = "body"): ProblemException {
    let thrown: unknown;
    try {
      pipe.transform(value, { ...bodyMeta, type });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(ProblemException);
    return thrown as ProblemException;
  }

  it("C9 (A3, unit): objeto vazio lança VALIDATION_FAILED com errors por campo", () => {
    expect(() => pipe.transform({}, bodyMeta)).toThrow(ProblemException);
    const ex = thrownBy({});
    expect(ex.code).toBe("VALIDATION_FAILED");
    expect(ex.detail).toBe("Dados inválidos.");
    expect(ex.errors).toHaveLength(2);
    expect(ex.errors?.[0]).toEqual({ field: "name", message: "Nome é obrigatório." });
    expect(ex.errors?.[1]?.field).toBe("age");
    expect(ex.errors?.[1]?.message.length).toBeGreaterThan(0);
  });

  it("C9 (A3, unit): name vazio aponta só name", () => {
    const ex = thrownBy({ name: "", age: 30 });
    expect(ex.errors).toHaveLength(1);
    expect(ex.errors).toEqual([{ field: "name", message: "Nome é obrigatório." }]);
  });

  it("C10 (A3, unit): age inválido aponta só age", () => {
    const ageInputs: unknown[] = [
      { name: "Ana", age: 151 },
      { name: "Ana", age: -1 },
      { name: "Ana", age: "30" },
    ];
    for (const input of ageInputs) {
      const ex = thrownBy(input);
      expect(ex.errors).toHaveLength(1);
      expect(ex.errors?.[0]?.field).toBe("age");
      expect(ex.errors?.[0]?.message.length).toBeGreaterThan(0);
    }
  });

  it("C10 (A3, unit): campos extras, null e array apontam só body", () => {
    const rootInputs: unknown[] = [{ name: "Ana", age: 30, role: "admin" }, null, []];
    for (const input of rootInputs) {
      const ex = thrownBy(input);
      expect(ex.errors).toHaveLength(1);
      expect(ex.errors?.[0]?.field).toBe("body");
      expect(ex.errors?.[0]?.message.length).toBeGreaterThan(0);
    }
  });

  it("C10 (A3, unit): type query com problema na raiz aponta field query", () => {
    const rootInputs: unknown[] = [{ name: "Ana", age: 30, role: "admin" }, null, []];
    for (const input of rootInputs) {
      const ex = thrownBy(input, "query");
      expect(ex.errors).toHaveLength(1);
      expect(ex.errors?.[0]?.field).toBe("query");
      expect(ex.errors?.[0]?.message.length).toBeGreaterThan(0);
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
