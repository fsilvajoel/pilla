import { describe, expect, it } from "vitest";
import { createPersonRequest, personListResponse, personSummarySchema } from "./create-person";
import { personListQuery } from "./person-list-query";
import { personResponse } from "./person-response";
import { updatePersonRequest } from "./update-person";
import { errorCodeSchema, errorStatus, problemSchema } from "../problem";

const ANA_ID = "01970000-0000-7000-8000-000000000001";
const OTHER_ID = "01970000-0000-7000-8000-000000000002";

const validCreate = { fullName: "Ana Costa", cpf: "52998224725", phone: "+5511987654321" };

function issuePaths(result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }): string[] {
  return [...new Set((result.error?.issues ?? []).map((i) => i.path.map(String).join(".")))];
}

describe("createPersonRequest (C2, A2)", () => {
  it("C2 (A2): accepts the minimal body and trims the name", () => {
    const result = createPersonRequest.safeParse({ ...validCreate, fullName: "  Ana Costa  " });
    expect(result.success).toBe(true);
    expect(result.data).toEqual(validCreate);
  });

  it("C2 (A2): accepts every optional field", () => {
    const body = {
      ...validCreate,
      email: "ana@example.com",
      birthDate: "1990-05-17",
      referredById: OTHER_ID,
      notes: "  cliente antiga  ",
    };
    const result = createPersonRequest.safeParse(body);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ ...body, notes: "cliente antiga" });
  });

  it.each([
    ["masked CPF", { cpf: "529.982.247-25" }, "cpf"],
    ["CPF with invalid check digits", { cpf: "11111111111" }, "cpf"],
    ["masked phone", { phone: "(11) 99999-0000" }, "phone"],
    ["empty name", { fullName: "" }, "fullName"],
    ["blank name", { fullName: "   " }, "fullName"],
    ["151-character name", { fullName: "a".repeat(151) }, "fullName"],
    ["invalid e-mail", { email: "nao-e-email" }, "email"],
    ["null optional", { email: null }, "email"],
    ["invalid birth date", { birthDate: "2026-02-30" }, "birthDate"],
    ["non-v7 referrer id", { referredById: "not-a-uuid" }, "referredById"],
    ["notes over 2000", { notes: "x".repeat(2001) }, "notes"],
    ["blank notes", { notes: "  " }, "notes"],
  ])("C2 (A2): rejects %s", (_name, patch, field) => {
    const result = createPersonRequest.safeParse({ ...validCreate, ...patch });
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toEqual([field]);
  });

  it("C2 (A2): accepts a 150-character name", () => {
    expect(createPersonRequest.safeParse({ ...validCreate, fullName: "a".repeat(150) }).success).toBe(true);
  });

  it("C2 (A2): rejects an unknown key", () => {
    const result = createPersonRequest.safeParse({ ...validCreate, active: true });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.code).toBe("unrecognized_keys");
  });

  it("C2 (A2): rejects missing required fields", () => {
    const result = createPersonRequest.safeParse({});
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toEqual(["fullName", "cpf", "phone"]);
  });
});

describe("personListQuery (C7, A7)", () => {
  it("C7 (A7): applies the defaults", () => {
    const result = personListQuery.safeParse({});
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ search: "", limit: 20 });
  });

  it("C7 (A7): accepts search, limit and cursor", () => {
    const result = personListQuery.safeParse({ search: "jose", limit: 100, cursor: "abc" });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ search: "jose", limit: 100, cursor: "abc" });
  });

  it("C7 (A7): accepts limit 1 and a null cursor", () => {
    const result = personListQuery.safeParse({ limit: 1, cursor: null });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ search: "", limit: 1, cursor: null });
  });

  it.each([0, -1, 101, 1.5])("C7 (A7): rejects limit %s", (limit) => {
    const result = personListQuery.safeParse({ limit });
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toEqual(["limit"]);
  });

  it("C7 (A7): rejects a text limit", () => {
    const result = personListQuery.safeParse({ limit: "abc" });
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toEqual(["limit"]);
  });
});

describe("personSummarySchema and personListResponse (C5, A5)", () => {
  const summary = { id: ANA_ID, fullName: "Ana Costa", cpf: "52998224725", phone: "+5511987654321", active: true };

  it("C5 (A5): accepts a summary with null cpf", () => {
    const result = personSummarySchema.safeParse({ ...summary, cpf: null });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ ...summary, cpf: null });
  });

  it("C5 (A5): rejects an extra property, a missing property and an invalid cpf", () => {
    expect(personSummarySchema.safeParse({ ...summary, version: 1 }).success).toBe(false);
    expect(personSummarySchema.safeParse({ ...summary, phone: undefined }).success).toBe(false);
    expect(personSummarySchema.safeParse({ ...summary, cpf: "11111111111" }).success).toBe(false);
  });

  it("C5 (A5): accepts the empty page and a page with cursor", () => {
    expect(personListResponse.parse({ items: [], nextCursor: null })).toEqual({ items: [], nextCursor: null });
    expect(personListResponse.parse({ items: [summary], nextCursor: "c1" })).toEqual({
      items: [summary],
      nextCursor: "c1",
    });
  });

  it("C5 (A5): rejects a page without nextCursor", () => {
    expect(personListResponse.safeParse({ items: [] }).success).toBe(false);
  });
});

describe("personResponse (C1, C8, A1, A8)", () => {
  const basic = {
    id: ANA_ID,
    fullName: "Ana Costa",
    cpf: "52998224725",
    phone: "+5511987654321",
    active: true,
    version: 1,
  };

  it("C1 (A1): accepts the basic body", () => {
    expect(personResponse.parse(basic)).toEqual(basic);
  });

  it("C8 (A8): accepts the optional non-null fields", () => {
    const full = { ...basic, email: "ana@example.com", birthDate: "1990-05-17", notes: "obs" };
    expect(personResponse.parse(full)).toEqual(full);
  });

  it.each([
    ["extra addresses", { addresses: [] }],
    ["extra referrer", { referrer: null }],
    ["null email", { email: null }],
    ["null notes", { notes: null }],
    ["string version", { version: "1" }],
    ["null cpf", { cpf: null }],
  ])("C8 (A8): rejects %s", (_name, patch) => {
    expect(personResponse.safeParse({ ...basic, ...patch }).success).toBe(false);
  });

  it("C8 (A8): rejects a missing version", () => {
    expect(personResponse.safeParse({ ...basic, version: undefined }).success).toBe(false);
  });
});

describe("updatePersonRequest (C9, C10, A9, A10)", () => {
  it("C9 (A9): accepts version alone", () => {
    expect(updatePersonRequest.parse({ version: 0 })).toEqual({ version: 0 });
  });

  it("C9 (A9): accepts null for email, birthDate and notes", () => {
    const body = { version: 3, notes: null, email: null, birthDate: null };
    expect(updatePersonRequest.parse(body)).toEqual(body);
  });

  it("C9 (A9): accepts editable fields and trims", () => {
    const result = updatePersonRequest.parse({
      version: 2,
      fullName: "  Ana Maria  ",
      cpf: "11144477735",
      phone: "+5511912345678",
      email: "ana@example.com",
      birthDate: "1990-05-17",
      notes: "obs",
    });
    expect(result).toEqual({
      version: 2,
      fullName: "Ana Maria",
      cpf: "11144477735",
      phone: "+5511912345678",
      email: "ana@example.com",
      birthDate: "1990-05-17",
      notes: "obs",
    });
  });

  it.each([
    ["missing version", {}, "version"],
    ["negative version", { version: -1 }, "version"],
    ["fractional version", { version: 1.5 }, "version"],
    ["null cpf", { version: 1, cpf: null }, "cpf"],
    ["invalid cpf", { version: 1, cpf: "11111111111" }, "cpf"],
    ["masked phone", { version: 1, phone: "(11) 99999-0000" }, "phone"],
    ["blank name", { version: 1, fullName: "  " }, "fullName"],
    ["null name", { version: 1, fullName: null }, "fullName"],
    ["null phone", { version: 1, phone: null }, "phone"],
  ])("C9 (A9): rejects %s", (_name, body, field) => {
    const result = updatePersonRequest.safeParse(body);
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toEqual([field]);
  });

  it.each([
    ["active", { version: 1, active: false }],
    ["referredById", { version: 1, referredById: OTHER_ID }],
    ["unknown key", { version: 1, foo: "bar" }],
  ])("C9 (A9): rejects the key %s", (_name, body) => {
    const result = updatePersonRequest.safeParse(body);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.code).toBe("unrecognized_keys");
  });
});

describe("problem catalog (C3, C11, A3, A11)", () => {
  it("C3 (A3): DUPLICATE_CPF is a known code with status 409", () => {
    expect(errorCodeSchema.safeParse("DUPLICATE_CPF").success).toBe(true);
    expect((errorStatus as Record<string, number>)["DUPLICATE_CPF"]).toBe(409);
  });

  it("C3 (A3): accepts the DUPLICATE_CPF problem body", () => {
    const body = { title: "DUPLICATE_CPF", status: 409, detail: "CPF já cadastrado.", code: "DUPLICATE_CPF" };
    expect(problemSchema.parse(body)).toEqual(body);
  });
});
