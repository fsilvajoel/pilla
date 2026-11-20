import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ProblemException } from "./problem-exception";
import { ZodValidationPipe } from "./zod-validation.pipe";

const schema = z.strictObject({
  name: z.string().min(1, "Nome é obrigatório."),
  age: z.int().min(0).max(150),
});
const pipe = new ZodValidationPipe(schema);

function problemOf(value: unknown, type: "body" | "query" = "body"): ProblemException {
  try {
    pipe.transform(value, { type });
  } catch (error: unknown) {
    if (error instanceof ProblemException) return error;
    throw error;
  }
  throw new Error("o pipe deveria ter lançado");
}

describe("ZodValidationPipe", () => {
  it("devolve o valor válido", () => {
    expect(pipe.transform({ name: "Ana", age: 30 }, { type: "body" })).toEqual({ name: "Ana", age: 30 });
  });

  it("devolve a saída do schema com transform aplicado", () => {
    const coerce = new ZodValidationPipe(z.object({ limit: z.string().transform((s) => s.length) }));
    expect(coerce.transform({ limit: "abc" }, { type: "query" })).toEqual({ limit: 3 });
  });

  it("lança VALIDATION_FAILED com um item por campo, na ordem do schema", () => {
    const problem = problemOf({});
    expect(problem.code).toBe("VALIDATION_FAILED");
    expect(problem.getStatus()).toBe(400);
    expect(problem.detail).toBe("Dados inválidos.");
    expect(problem.errors?.map((e) => e.field)).toEqual(["name", "age"]);
  });

  it("usa a mensagem do schema", () => {
    expect(problemOf({ name: "", age: 30 }).errors).toEqual([{ field: "name", message: "Nome é obrigatório." }]);
  });

  it.each([[{ name: "Ana", age: 151 }], [{ name: "Ana", age: -1 }], [{ name: "Ana", age: "30" }]])(
    "aponta o campo age em %j",
    (value) => {
      expect(problemOf(value).errors?.map((e) => e.field)).toEqual(["age"]);
    },
  );

  it.each([[{ name: "Ana", age: 30, role: "admin" }], [null], [[]]])("aponta a raiz (body) em %j", (value) => {
    expect(problemOf(value).errors?.map((e) => e.field)).toEqual(["body"]);
  });

  it("aponta a raiz pelo tipo do parâmetro (query)", () => {
    expect(problemOf(null, "query").errors?.map((e) => e.field)).toEqual(["query"]);
  });

  it("devolve a saída do schema ou lança ProblemException sem campo repetido nem mensagem vazia", () => {
    fc.assert(
      fc.property(fc.anything(), (value) => {
        const expected = schema.safeParse(value);
        if (expected.success) {
          expect(pipe.transform(value, { type: "body" })).toEqual(expected.data);
          return;
        }
        const problem = problemOf(value);
        const fields = (problem.errors ?? []).map((e) => e.field);
        expect(new Set(fields).size).toBe(fields.length);
        expect(fields.length).toBeGreaterThan(0);
        expect((problem.errors ?? []).every((e) => e.message.length > 0)).toBe(true);
      }),
    );
  });
});
