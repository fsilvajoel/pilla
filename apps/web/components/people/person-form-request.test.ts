import { describe, expect, it } from "vitest";
import {
  checkCreateRequest,
  checkUpdateRequest,
  emptyPersonFormValues,
  toCreateBody,
  toUpdateBody,
} from "./person-form-request";

const valid = { ...emptyPersonFormValues, fullName: "Ana Costa", cpf: "529.982.247-25", phone: "+5511987654321" };

describe("person-form-request", () => {
  it("criação deixa de fora os opcionais vazios e aceita CPF com máscara", () => {
    const body = toCreateBody(valid);
    expect(body).toEqual({ fullName: "Ana Costa", cpf: "529.982.247-25", phone: "+5511987654321" });
    const check = checkCreateRequest(body);
    expect(check.ok && check.data.cpf).toBe("52998224725");
  });

  it("criação inclui os opcionais preenchidos", () => {
    const body = toCreateBody({ ...valid, email: "a@b.com", birthDate: "1990-01-31", referredById: "x", notes: "n" });
    expect(body).toMatchObject({ email: "a@b.com", birthDate: "1990-01-31", referredById: "x", notes: "n" });
  });

  it("devolve erro por campo", () => {
    const check = checkCreateRequest(toCreateBody({ ...valid, cpf: "123", email: "ruim" }));
    expect(check.ok).toBe(false);
    if (!check.ok) {
      expect(Object.keys(check.fieldErrors)).toEqual(expect.arrayContaining(["cpf", "email"]));
    }
  });

  it("edição limpa opcionais vazios com null e leva a versão", () => {
    const body = toUpdateBody(valid, 3);
    expect(body).toMatchObject({ email: null, birthDate: null, notes: null, version: 3 });
    const check = checkUpdateRequest(body);
    expect(check.ok && check.data.version).toBe(3);
  });

  it("edição inválida devolve erro por campo", () => {
    const check = checkUpdateRequest(toUpdateBody({ ...valid, phone: "1" }, 0));
    expect(!check.ok && "phone" in check.fieldErrors).toBe(true);
  });
});
