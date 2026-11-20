import { describe, expect, it } from "vitest";
import { ApiProblem, parseProblem } from "@/lib/api/problem";
import { toActionError } from "./people-action-result";

describe("toActionError", () => {
  it("repassa code, detalhe e erros de campo de um problema 4xx", () => {
    const problem = parseProblem(409, {
      title: "Conflito",
      status: 409,
      code: "DUPLICATE_CPF",
      detail: "CPF já cadastrado.",
      errors: [{ field: "cpf", message: "CPF já cadastrado." }],
    });
    const result = toActionError(problem);
    expect(result).toEqual({
      ok: false,
      code: "DUPLICATE_CPF",
      message: "CPF já cadastrado.",
      fieldErrors: { cpf: "CPF já cadastrado." },
    });
  });

  it("esconde detalhe de erro desconhecido ou 5xx", () => {
    expect(toActionError(new Error("segredo")).message).not.toContain("segredo");
    expect(toActionError(new ApiProblem(500, null)).code).toBeNull();
  });
});
