import { describe, expect, it } from "vitest";
import { parseProblem } from "@/lib/api/problem";
import {
  canActivate,
  canCancel,
  canRegisterPayment,
  checkActivateLoan,
  checkCreateLoan,
  formatDateBr,
  parseLoanFilters,
  toLoanActionError,
} from "./loan-actions";

const ID = "01890a5d-ac96-774b-bcce-b302099a8057";

describe("loan-actions", () => {
  it("Ativar e Cancelar só em DRAFT", () => {
    expect(canActivate("DRAFT")).toBe(true);
    expect(canCancel("DRAFT")).toBe(true);
    for (const s of ["ACTIVE", "PAID_OFF", "RENEWED", "RENEGOTIATED", "WRITTEN_OFF", "CANCELLED"] as const) {
      expect(canActivate(s)).toBe(false);
      expect(canCancel(s)).toBe(false);
    }
    expect(canRegisterPayment("ACTIVE")).toBe(true);
    expect(canRegisterPayment("DRAFT")).toBe(false);
  });

  it("traduz códigos conhecidos e esconde erro desconhecido", () => {
    const conflict = toLoanActionError(
      parseProblem(409, { title: "Conflito", status: 409, code: "VERSION_CONFLICT", detail: "d" }),
    );
    expect(conflict.code).toBe("VERSION_CONFLICT");
    expect(conflict.message).toContain("Recarregue");
    const generic = toLoanActionError(new Error("stack interno"));
    expect(generic.code).toBeNull();
    expect(generic.message).not.toContain("stack");
  });

  it("valida ativação e criação", () => {
    expect(checkActivateLoan({ disbursedAt: "2026-11-20", accountId: ID }).ok).toBe(true);
    const bad = checkActivateLoan({ disbursedAt: "20/11/2026", accountId: "" });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(Object.keys(bad.fieldErrors).sort()).toEqual(["accountId", "disbursedAt"]);
    expect(checkCreateLoan({}).ok).toBe(false);
  });

  it("formata data e filtros", () => {
    expect(formatDateBr("2026-11-20")).toBe("20/11/2026");
    expect(parseLoanFilters({ status: "DRAFT", standing: "OVERDUE" })).toEqual({
      status: "DRAFT",
      standing: "OVERDUE",
    });
    expect(parseLoanFilters({ status: "XX", standing: "Y" })).toEqual({});
  });
});
