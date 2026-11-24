import { describe, expect, it } from "vitest";
import { createPortalSessionRequest } from "./portal-session";

const CPF = "52998224725";

describe("createPortalSessionRequest", () => {
  it("A1: accepts an 11-digit valid CPF", () => {
    expect(createPortalSessionRequest.safeParse({ cpf: CPF }).success).toBe(true);
  });

  it.each([
    ["punctuation", "529.982.247-25"],
    ["10 digits", CPF.slice(0, 10)],
    ["12 digits", `${CPF}0`],
    ["a wrong check digit", `${CPF.slice(0, 10)}${String((Number(CPF[10]) + 1) % 10)}`],
    ["repeated digits", "11111111111"],
    ["empty", ""],
    ["a number", Number(CPF)],
  ])("A1: rejects %s", (_name, cpf) => {
    expect(createPortalSessionRequest.safeParse({ cpf }).success).toBe(false);
  });

  it("A1: rejects an extra key and a missing cpf", () => {
    expect(createPortalSessionRequest.safeParse({ cpf: CPF, extra: 1 }).success).toBe(false);
    expect(createPortalSessionRequest.safeParse({}).success).toBe(false);
  });
});
