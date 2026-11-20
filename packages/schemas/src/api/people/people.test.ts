import { describe, expect, it } from "vitest";
import { errorStatus, problemSchema } from "../problem";
import { createPersonRequest, personListResponse, personSummarySchema } from "./create-person";
import { personListQuery } from "./person-list-query";
import { updatePersonRequest } from "./update-person";

const ANA_ID = "01970000-0000-7000-8000-000000000001";
const OTHER_ID = "01970000-0000-7000-8000-000000000002";
const ANA_CPF = "52998224725";
const ANA_PHONE = "+5511987654321";

const basicResponse = { id: ANA_ID, fullName: "Ana Costa", cpf: ANA_CPF, phone: ANA_PHONE, active: true, version: 1 };

// person-response.ts nasce no E9-T06/contrato; o import é dinâmico para o arquivo carregar (e ficar vermelho) sem ele.
async function loadPersonResponse(): Promise<{ safeParse(input: unknown): { success: boolean } }> {
  const path = "./person-response";
  const mod = (await import(/* @vite-ignore */ path)) as {
    personResponse: { safeParse(input: unknown): { success: boolean } };
  };
  return mod.personResponse;
}

describe("PersonResponse (C1, C8, C9)", () => {
  it("C1 (A1): aceita a resposta básica exata, com e sem opcionais", async () => {
    const personResponse = await loadPersonResponse();

    expect(personResponse.safeParse(basicResponse).success).toBe(true);
    expect(
      personResponse.safeParse({ ...basicResponse, email: "ana@example.com", birthDate: "1990-01-31", notes: "obs" })
        .success,
    ).toBe(true);
  });

  it("C8 (A8): é estrito e não aceita campos agregados da ficha", async () => {
    const personResponse = await loadPersonResponse();

    expect(personResponse.safeParse(basicResponse).success).toBe(true);
    for (const extra of [{ addresses: [] }, { pixKeys: [] }, { referrer: null }, { referrals: [] }]) {
      expect(personResponse.safeParse({ ...basicResponse, ...extra }).success).toBe(false);
    }
  });

  it("C9 (A9): exige version e não aceita null nos opcionais", async () => {
    const personResponse = await loadPersonResponse();
    const withoutVersion = { id: ANA_ID, fullName: "Ana Costa", cpf: ANA_CPF, phone: ANA_PHONE, active: true };

    expect(personResponse.safeParse(basicResponse).success).toBe(true);
    expect(personResponse.safeParse(withoutVersion).success).toBe(false);
    for (const field of ["email", "birthDate", "notes"]) {
      expect(personResponse.safeParse({ ...basicResponse, [field]: null }).success).toBe(false);
    }
  });
});

describe("PersonListResponse (C5)", () => {
  it("C5 (A5): item importado sem CPF tem cpf null e passa no resumo e na lista", () => {
    const imported = { id: OTHER_ID, fullName: "Beto Importado", cpf: null, phone: ANA_PHONE, active: true };

    expect(personSummarySchema.safeParse(imported).success).toBe(true);
    expect(personListResponse.safeParse({ items: [imported], nextCursor: null }).success).toBe(true);
  });

  it("C5 (A5): lista vazia, propriedade extra e CPF ausente", () => {
    const item = { id: ANA_ID, fullName: "Ana Costa", cpf: ANA_CPF, phone: ANA_PHONE, active: true };
    const imported = { ...item, cpf: null };

    expect(personListResponse.safeParse({ items: [], nextCursor: null }).success).toBe(true);
    expect(personListResponse.safeParse({ items: [{ ...item, extra: 1 }], nextCursor: null }).success).toBe(false);
    const withoutCpf = { id: ANA_ID, fullName: "Ana Costa", phone: ANA_PHONE, active: true };
    expect(personListResponse.safeParse({ items: [withoutCpf], nextCursor: null }).success).toBe(false);
    expect(personListResponse.safeParse({ items: [imported], nextCursor: null }).success).toBe(true);
  });
});

describe("updatePersonRequest (C9, C10)", () => {
  it("C9 (A9): null limpa email, birthDate e notes", () => {
    const result = updatePersonRequest.safeParse({ version: 3, notes: null, email: null, birthDate: null });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ version: 3, notes: null, email: null, birthDate: null });
    }
  });

  it("C9 (A9): cpf null, referredById, active e campo extra são recusados mesmo com os nulls válidos", () => {
    expect(updatePersonRequest.safeParse({ version: 3, email: null }).success).toBe(true);
    expect(updatePersonRequest.safeParse({ version: 3, cpf: null }).success).toBe(false);
    expect(updatePersonRequest.safeParse({ version: 3, referredById: OTHER_ID }).success).toBe(false);
    expect(updatePersonRequest.safeParse({ version: 3, active: false }).success).toBe(false);
    expect(updatePersonRequest.safeParse({ version: 3, extra: "x" }).success).toBe(false);
  });

  it("C9/C10 (A9, A10): version é obrigatória, inteira e não negativa, com null aceito nos opcionais", () => {
    expect(updatePersonRequest.safeParse({ version: 0, notes: null }).success).toBe(true);
    expect(updatePersonRequest.safeParse({ notes: null }).success).toBe(false);
    expect(updatePersonRequest.safeParse({ fullName: "Ana", notes: null }).success).toBe(false);
    expect(updatePersonRequest.safeParse({ version: -1, notes: null }).success).toBe(false);
    expect(updatePersonRequest.safeParse({ version: 1.5, notes: null }).success).toBe(false);
  });

  it("C9 (A9): campos ausentes continuam ausentes e os informados são validados e aparados", () => {
    const result = updatePersonRequest.safeParse({ version: 2, fullName: "  Ana Souza  ", email: null });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ version: 2, fullName: "Ana Souza", email: null });
    }
    expect(updatePersonRequest.safeParse({ version: 2, cpf: "11111111111", email: null }).success).toBe(false);
  });
});

describe("contratos de apoio (C2, C3, C7, C11)", () => {
  it("C3/C11 (A3, A11): DUPLICATE_CPF e VERSION_CONFLICT são 409, o problem valida e PATCH aceita birthDate null", () => {
    expect(errorStatus.DUPLICATE_CPF).toBe(409);
    expect(errorStatus.VERSION_CONFLICT).toBe(409);
    const problem = { title: "DUPLICATE_CPF", status: 409, detail: "CPF já cadastrado.", code: "DUPLICATE_CPF" };
    expect(problemSchema.safeParse(problem).success).toBe(true);
    expect(problemSchema.safeParse({ ...problem, status: 400 }).success).toBe(false);
    expect(updatePersonRequest.safeParse({ version: 1, birthDate: null }).success).toBe(true);
  });

  it("C2 (A2): create normaliza máscara, recusa nulo em opcional; update aceita o mesmo CPF mascarado", () => {
    const masked = createPersonRequest.safeParse({ fullName: "Ana Costa", cpf: "529.982.247-25", phone: ANA_PHONE });
    expect(masked.success).toBe(true);
    if (masked.success) expect(masked.data.cpf).toBe(ANA_CPF);
    expect(
      createPersonRequest.safeParse({ fullName: "Ana Costa", cpf: ANA_CPF, phone: ANA_PHONE, notes: null }).success,
    ).toBe(false);
    expect(updatePersonRequest.safeParse({ version: 1, cpf: "529.982.247-25", notes: null }).success).toBe(true);
  });

  it("C7 (A7): query usa limit 20 por padrão, aceita 1 a 100 e recusa o resto; cursor aceita null", () => {
    expect(personListQuery.parse({}).limit).toBe(20);
    expect(personListQuery.parse({ limit: "100" }).limit).toBe(100);
    for (const limit of ["0", "-1", "101", "1.5", "1e1", "", "abc"]) {
      expect(personListQuery.safeParse({ limit }).success).toBe(false);
    }
    expect(personListQuery.safeParse({ cursor: "abc" }).success).toBe(true);
    expect(personListQuery.safeParse({ cursor: null }).success).toBe(true);
  });
});
