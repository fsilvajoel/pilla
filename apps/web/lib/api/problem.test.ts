import { describe, expect, it } from "vitest";
import { ApiProblem, parseProblem } from "./problem";

const validProblem = {
  title: "Dados inválidos",
  status: 400,
  detail: "Há campos inválidos",
  code: "VALIDATION_FAILED",
  errors: [
    { field: "cpf", message: "CPF inválido" },
    { field: "phone", message: "Telefone inválido" },
  ],
};

describe("ApiProblem", () => {
  it("usa detail, code e erros por campo do problem", () => {
    const err = new ApiProblem(400, {
      title: "Dados inválidos",
      status: 400,
      detail: "Há campos inválidos",
      code: "VALIDATION_FAILED",
      errors: [{ field: "cpf", message: "CPF inválido" }],
    });
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("ApiProblem");
    expect(err.message).toBe("Há campos inválidos");
    expect(err.status).toBe(400);
    expect(err.code).toBe("VALIDATION_FAILED");
    expect(err.fieldErrors).toEqual([{ field: "cpf", message: "CPF inválido" }]);
    expect(err.fieldMessages()).toEqual({ cpf: "CPF inválido" });
  });

  it("sem problem: mensagem genérica, code nulo e sem erros de campo", () => {
    const err = new ApiProblem(502, null);
    expect(err.message).toBe("Falha na API (HTTP 502)");
    expect(err.status).toBe(502);
    expect(err.code).toBeNull();
    expect(err.fieldErrors).toEqual([]);
    expect(err.fieldMessages()).toEqual({});
  });

  it("problem sem errors: lista vazia", () => {
    const err = new ApiProblem(404, {
      title: "Não achou",
      status: 404,
      detail: "Pessoa não encontrada",
      code: "NOT_FOUND",
    });
    expect(err.code).toBe("NOT_FOUND");
    expect(err.fieldErrors).toEqual([]);
  });
});

describe("parseProblem", () => {
  it("corpo problem+json válido vira ApiProblem com os campos", () => {
    const err = parseProblem(400, validProblem);
    expect(err.status).toBe(400);
    expect(err.code).toBe("VALIDATION_FAILED");
    expect(err.message).toBe("Há campos inválidos");
    expect(err.fieldMessages()).toEqual({ cpf: "CPF inválido", phone: "Telefone inválido" });
  });

  it.each([null, "texto", 42, { foo: "bar" }, { ...validProblem, code: "OUTRO" }])(
    "corpo que não é problem (%j) vira ApiProblem genérico",
    (body) => {
      const err = parseProblem(500, body);
      expect(err.status).toBe(500);
      expect(err.code).toBeNull();
      expect(err.message).toBe("Falha na API (HTTP 500)");
    },
  );
});
