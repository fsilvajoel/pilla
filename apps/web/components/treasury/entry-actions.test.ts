import { describe, expect, it } from "vitest";
import { ApiProblem } from "@/lib/api/problem";
import { toEntryActionError } from "./entry-actions";

describe("toEntryActionError", () => {
  it("erro desconhecido vira mensagem genérica", () => {
    const result = toEntryActionError(new Error("boom"));
    expect(result).toMatchObject({ ok: false, code: null });
    expect(result.message).not.toContain("boom");
  });

  it("código conhecido ganha texto em pt-BR", () => {
    const error = new ApiProblem(404, { title: "t", status: 404, detail: "d", code: "NOT_FOUND" });
    expect(toEntryActionError(error).message).toBe("Conta não encontrada.");
  });
});
