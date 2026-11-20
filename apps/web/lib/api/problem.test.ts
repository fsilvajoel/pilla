import { describe, expect, it } from "vitest";
import { ApiProblem, parseProblem } from "./problem";

const validation = { title: "Inválido", status: 400, detail: "Confira os campos.", code: "VALIDATION_FAILED" };

describe("parseProblem", () => {
  it("keeps code, detail and field messages of a valid problem", () => {
    const error = parseProblem(400, {
      ...validation,
      errors: [{ field: "cpf", message: "CPF inválido" }],
    });

    expect(error).toBeInstanceOf(ApiProblem);
    expect(error.status).toBe(400);
    expect(error.code).toBe("VALIDATION_FAILED");
    expect(error.message).toBe("Confira os campos.");
    expect(error.fieldMessages()).toEqual({ cpf: "CPF inválido" });
  });

  it("has no field messages when the problem carries no errors", () => {
    expect(parseProblem(400, validation).fieldMessages()).toEqual({});
  });

  it("falls back to a generic error when the body is not a problem", () => {
    const error = parseProblem(502, "<html>bad gateway</html>");

    expect(error.code).toBeNull();
    expect(error.message).toBe("Falha na API (HTTP 502)");
    expect(error.fieldErrors).toEqual([]);
  });
});
