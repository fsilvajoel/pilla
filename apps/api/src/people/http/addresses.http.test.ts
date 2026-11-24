import type { PGlite } from "@electric-sql/pglite";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { addressSchema, problemSchema } from "@pilla/schemas";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { type AdminAgent, loginAsAdmin } from "../../core/http/test-admin-agent";
import { AppModule } from "../../app.module";
import { configureApp } from "../../core/http/configure-app";
import type { ApiEnv } from "../../core/http/env";
import { DATABASE_HANDLE } from "../../db/database";
import { migratedTestDb } from "../../db/test-db";

// newId() é controlado pelo teste: cada criação consome o próximo id da fila (A1: Ana = ...0001).
const idQueue = vi.hoisted(() => ({ ids: [] as string[] }));
vi.mock("../../core/public/ids", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../core/public/ids")>();
  return { ...original, newId: (): string => idQueue.ids.shift() ?? original.newId() };
});

const P1 = "01970000-0000-7000-8000-000000000101";
const P2 = "01970000-0000-7000-8000-000000000102";
const UNKNOWN_PERSON = "01970000-0000-7000-8000-000000000199";
const V4_ID = "5b1f6f0e-8f0a-4c3e-9a57-3c1f2b7d9e10";
const A1 = "01970000-0000-7000-8000-000000000201";
const A2 = "01970000-0000-7000-8000-000000000202";
const A3 = "01970000-0000-7000-8000-000000000203";
const UNKNOWN_ADDRESS = "01970000-0000-7000-8000-000000000299";

const env: ApiEnv = { host: "127.0.0.1", port: 3000, databaseUrl: "postgres://u:p@127.0.0.1:1/pilla" };

let client: PGlite;
let admin: AdminAgent;
let app: INestApplication;
let baseUrl: string;

beforeAll(async () => {
  const migrated = await migratedTestDb();
  client = migrated.client;
  const moduleRef = await Test.createTestingModule({ imports: [AppModule.forRoot(env, { outboxPoller: false })] })
    .overrideProvider(DATABASE_HANDLE)
    .useValue({ db: migrated.db, close: () => Promise.resolve() })
    .compile();
  app = moduleRef.createNestApplication();
  configureApp(app);
  await app.listen(0, "127.0.0.1");
  baseUrl = await app.getUrl();
  admin = await loginAsAdmin(baseUrl, client);
});

afterAll(async () => {
  await app.close();
  await client.close();
});

beforeEach(async () => {
  idQueue.ids.length = 0;
  await client.query("delete from people.addresses");
  await client.query("delete from people.pix_keys");
  await client.query("delete from people.persons");
  await seedPerson(P1, "11144477735");
  await seedPerson(P2, "52998224725");
});

afterEach(() => {
  idQueue.ids.length = 0;
});

async function seedPerson(id: string, cpf: string): Promise<void> {
  await client.query(
    "insert into people.persons (id, full_name, cpf, phone) values ($1, 'Ana Costa', $2, '+5511987654321')",
    [id, cpf],
  );
}

type Problem = { title: string; status: number; detail: string; code: string };
const notFoundProblem: Problem = {
  title: "Não encontrado",
  status: 404,
  detail: "Recurso não encontrado.",
  code: "NOT_FOUND",
};

type HttpResult = { status: number; body: unknown; contentType: string; location: string | undefined; text: string };

async function send(method: "post" | "patch" | "delete", path: string, body?: object): Promise<HttpResult> {
  const call = admin[method](path);
  const res = body === undefined ? await call : await call.send(body);
  const location: unknown = res.headers["location"];
  return {
    status: res.status,
    body: res.body as unknown,
    contentType: res.headers["content-type"] ?? "",
    location: typeof location === "string" ? location : undefined,
    text: res.text,
  };
}

function expectNotFound(res: HttpResult): void {
  expect(res.status).toBe(404);
  expect(res.contentType).toMatch(/^application\/problem\+json/);
  expect(res.body).toEqual(notFoundProblem);
  expect(problemSchema.safeParse(res.body).success).toBe(true);
}

function expectValidationFailed(res: HttpResult, fields: readonly string[]): void {
  expect(res.status).toBe(400);
  expect(res.contentType).toMatch(/^application\/problem\+json/);
  const parsed = problemSchema.safeParse(res.body);
  expect(parsed.success).toBe(true);
  if (!parsed.success) return;
  expect(parsed.data.code).toBe("VALIDATION_FAILED");
  expect(parsed.data.title).toBe("Validação falhou");
  expect(parsed.data.detail).toBe("Dados inválidos.");
  expect((parsed.data.errors ?? []).map((error) => error.field).sort()).toEqual([...fields].sort());
}

function expectNoContent(res: HttpResult): void {
  expect(res.status).toBe(204);
  expect(res.text).toBe("");
}

const validBody = {
  street: "Rua A",
  number: "10",
  district: "Centro",
  city: "São Paulo",
  state: "SP",
  postalCode: "01001000",
};
const a1Expected = { id: A1, ...validBody, isPrimary: true };

type AddressDbRow = { id: string; street: string; is_primary: boolean };

async function dbAddresses(): Promise<AddressDbRow[]> {
  const result = await client.query<AddressDbRow>("select id, street, is_primary from people.addresses order by id");
  return result.rows;
}

async function primaries(): Promise<string[]> {
  return (await dbAddresses()).filter((row) => row.is_primary).map((row) => row.id);
}

async function create(id: string, isPrimary?: boolean, person = P1): Promise<HttpResult> {
  idQueue.ids.push(id);
  return send("post", `/api/v1/people/${person}/addresses`, {
    ...validBody,
    ...(isPrimary === undefined ? {} : { isPrimary }),
  });
}

describe("POST /api/v1/people/{id}/addresses", () => {
  it("C1 (A1): cria com 201, Location e corpo exato sem complement", async () => {
    idQueue.ids.push(A1);
    const res = await send("post", `/api/v1/people/${P1}/addresses`, validBody);

    expect(res.status).toBe(201);
    expect(res.contentType).toMatch(/^application\/json/);
    expect(res.location).toBe(`/api/v1/people/${P1}/addresses/${A1}`);
    expect(res.body).toEqual(a1Expected);
    expect(addressSchema.safeParse(res.body).success).toBe(true);
    expect(res.body).not.toHaveProperty("complement");
    expect(await dbAddresses()).toHaveLength(1);
  });

  it("devolve complement aparado quando enviado", async () => {
    idQueue.ids.push(A1);
    const res = await send("post", `/api/v1/people/${P1}/addresses`, { ...validBody, complement: "  Apto 1  " });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ ...a1Expected, complement: "Apto 1" });
  });

  it("aceita number como texto e apara espaços", async () => {
    idQueue.ids.push(A1);
    const res = await send("post", `/api/v1/people/${P1}/addresses`, { ...validBody, number: " 6 " });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ ...a1Expected, number: "6" });
  });

  it("C3 (A3): o primeiro endereço nasce principal mesmo com isPrimary false", async () => {
    const res = await create(A1, false);

    expect(res.status).toBe(201);
    expect(res.body).toEqual(a1Expected);
    expect(await primaries()).toEqual([A1]);
  });

  it("C4 (A3): o segundo com isPrimary false não toma o principal", async () => {
    await create(A1, false);
    const res = await create(A2, false);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: A2, isPrimary: false });
    expect(await primaries()).toEqual([A1]);
  });

  it("o segundo com isPrimary omitido não é principal", async () => {
    await create(A1);
    const res = await create(A2);

    expect(res.body).toMatchObject({ id: A2, isPrimary: false });
    expect(await primaries()).toEqual([A1]);
  });

  it("C5 (A3): isPrimary true no terceiro desmarca os anteriores", async () => {
    await create(A1, false);
    await create(A2, false);
    const res = await create(A3, true);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: A3, isPrimary: true });
    expect(await primaries()).toEqual([A3]);
  });

  it("o principal de uma pessoa não afeta o de outra", async () => {
    await create(A1, true, P1);
    const res = await create(A2, false, P2);

    expect(res.body).toMatchObject({ id: A2, isPrimary: true });
    expect((await primaries()).sort()).toEqual([A1, A2]);
  });

  it("C12 (A5): pessoa inexistente dá 404 e não cria", async () => {
    idQueue.ids.push(A1);
    const res = await send("post", `/api/v1/people/${UNKNOWN_PERSON}/addresses`, validBody);

    expectNotFound(res);
    expect(await dbAddresses()).toHaveLength(0);
  });

  it.each([
    ["malformado", "abc"],
    ["UUID v4", V4_ID],
  ])("C12 (A5): id de pessoa %s dá 400 no parâmetro", async (_name, id) => {
    const res = await send("post", `/api/v1/people/${id}/addresses`, validBody);

    expectValidationFailed(res, ["param"]);
    expect(await dbAddresses()).toHaveLength(0);
  });
});

describe("POST addresses: validação (C2, C11)", () => {
  const invalid: ReadonlyArray<[string, Record<string, unknown>, string]> = [
    ["street vazio", { street: "" }, "street"],
    ["street só espaços", { street: "   " }, "street"],
    ["street 151", { street: "a".repeat(151) }, "street"],
    ["street não textual", { street: 5 }, "street"],
    ["number vazio", { number: "" }, "number"],
    ["number só espaços", { number: "  " }, "number"],
    ["number 21", { number: "1".repeat(21) }, "number"],
    ["number numérico", { number: 10 }, "number"],
    ["complement vazio", { complement: "" }, "complement"],
    ["complement só espaços", { complement: "  " }, "complement"],
    ["complement 101", { complement: "a".repeat(101) }, "complement"],
    ["complement nulo", { complement: null }, "complement"],
    ["district vazio", { district: "" }, "district"],
    ["district só espaços", { district: "  " }, "district"],
    ["district 101", { district: "a".repeat(101) }, "district"],
    ["city vazio", { city: "" }, "city"],
    ["city só espaços", { city: "  " }, "city"],
    ["city 101", { city: "a".repeat(101) }, "city"],
    ["state minúsculo", { state: "sp" }, "state"],
    ["state com dígito", { state: "S1" }, "state"],
    ["state com espaços", { state: " SP " }, "state"],
    ["state vazio", { state: "" }, "state"],
    ["postalCode vazio", { postalCode: "" }, "postalCode"],
    ["postalCode 7 dígitos", { postalCode: "0100100" }, "postalCode"],
    ["postalCode 9 dígitos", { postalCode: "010010000" }, "postalCode"],
    ["postalCode com hífen", { postalCode: "01001-000" }, "postalCode"],
    ["postalCode com letra", { postalCode: "0100100a" }, "postalCode"],
    ["isPrimary texto", { isPrimary: "true" }, "isPrimary"],
    ["isPrimary nulo", { isPrimary: null }, "isPrimary"],
    ["isPrimary número", { isPrimary: 1 }, "isPrimary"],
    ["campo extra", { extra: 1 }, "extra"],
    ["version", { version: 1 }, "version"],
  ];

  it.each(invalid)("%s dá 400 VALIDATION_FAILED", async (_name, override, field) => {
    idQueue.ids.push(A1);
    const res = await send("post", `/api/v1/people/${P1}/addresses`, { ...validBody, ...override });

    expectValidationFailed(res, [field]);
    expect(await dbAddresses()).toHaveLength(0);
  });

  it("corpo nulo dá 400", async () => {
    const res = await send("post", `/api/v1/people/${P1}/addresses`);

    expect(res.status).toBe(400);
    expect(res.contentType).toMatch(/^application\/problem\+json/);
  });
});

describe("PATCH /api/v1/addresses/{id}", () => {
  it("C6 (A3): isPrimary true transfere o principal", async () => {
    await create(A1, false);
    await create(A2, false);
    await create(A3, true);
    const res = await send("patch", `/api/v1/addresses/${A2}`, { isPrimary: true });

    expect(res.status).toBe(200);
    expect(res.contentType).toMatch(/^application\/json/);
    expect(res.body).toMatchObject({ id: A2, isPrimary: true });
    expect(addressSchema.safeParse(res.body).success).toBe(true);
    expect(await primaries()).toEqual([A2]);
  });

  it("C7 (A4): altera só os campos enviados", async () => {
    await create(A1);
    await create(A2);
    const res = await send("patch", `/api/v1/addresses/${A2}`, { street: "Rua B" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: A2, ...validBody, street: "Rua B", isPrimary: false });
    expect((await dbAddresses()).find((row) => row.id === A2)?.street).toBe("Rua B");
  });

  it("altera e apara complement", async () => {
    await create(A1);
    const res = await send("patch", `/api/v1/addresses/${A1}`, { complement: " Fundos " });

    expect(res.body).toEqual({ ...a1Expected, complement: "Fundos" });
  });

  it("C8 (A4): {} é no-op e devolve a mesma representação", async () => {
    await create(A1);
    await create(A2);
    const before = await send("patch", `/api/v1/addresses/${A2}`, { street: "Rua B" });
    const res = await send("patch", `/api/v1/addresses/${A2}`, {});

    expect(res.status).toBe(200);
    expect(res.body).toEqual(before.body);
    expect(await primaries()).toEqual([A1]);
  });

  it("C9 (A4): isPrimary false no principal deixa a pessoa sem principal e não promove", async () => {
    await create(A1);
    await create(A2);
    const res = await send("patch", `/api/v1/addresses/${A1}`, { isPrimary: false });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: A1, isPrimary: false });
    expect(await primaries()).toEqual([]);
  });

  it("isPrimary false em quem não é principal não mexe no principal", async () => {
    await create(A1);
    await create(A2);
    const res = await send("patch", `/api/v1/addresses/${A2}`, { isPrimary: false });

    expect(res.body).toMatchObject({ id: A2, isPrimary: false });
    expect(await primaries()).toEqual([A1]);
  });

  it("isPrimary true em quem já é principal continua principal", async () => {
    await create(A1);
    const res = await send("patch", `/api/v1/addresses/${A1}`, { isPrimary: true });

    expect(res.body).toEqual(a1Expected);
    expect(await primaries()).toEqual([A1]);
  });

  it("trocar o principal em uma pessoa não afeta a outra", async () => {
    await create(A1, true, P1);
    await create(A2, true, P2);
    await create(A3, false, P1);
    await send("patch", `/api/v1/addresses/${A3}`, { isPrimary: true });

    expect((await primaries()).sort()).toEqual([A2, A3]);
  });

  it("C12 (A5): endereço inexistente dá 404", async () => {
    const res1 = await send("patch", `/api/v1/addresses/${UNKNOWN_ADDRESS}`, { street: "Rua B" });
    expectNotFound(res1);
    expect(res1.status).toBe(404);
    const res2 = await send("patch", `/api/v1/addresses/${UNKNOWN_ADDRESS}`, {});
    expectNotFound(res2);
    expect(res2.status).toBe(404);
  });

  it.each([
    ["malformado", "abc"],
    ["UUID v4", V4_ID],
  ])("C12 (A5): id %s dá 400 no parâmetro", async (_name, id) => {
    const res3 = await send("patch", `/api/v1/addresses/${id}`, { street: "Rua B" });
    expectValidationFailed(res3, ["param"]);
    expect(res3.status).toBe(400);
  });

  it.each(invalid())("C11 (A2): %s dá 400 e não altera", async (_name, override, field) => {
    await create(A1);
    const res = await send("patch", `/api/v1/addresses/${A1}`, override);

    expectValidationFailed(res, [field]);
    expect((await dbAddresses())[0]?.street).toBe("Rua A");
  });
});

function invalid(): ReadonlyArray<[string, Record<string, unknown>, string]> {
  return [
    ["street vazio", { street: "" }, "street"],
    ["street 151", { street: "a".repeat(151) }, "street"],
    ["complement nulo", { complement: null }, "complement"],
    ["state minúsculo", { state: "sp" }, "state"],
    ["postalCode com hífen", { postalCode: "01001-000" }, "postalCode"],
    ["isPrimary texto", { isPrimary: "true" }, "isPrimary"],
    ["campo extra", { extra: 1 }, "extra"],
    ["version", { version: 1 }, "version"],
  ];
}

describe("DELETE /api/v1/addresses/{id}", () => {
  it("C10 (A4): excluir o principal dá 204 sem corpo e não promove outro", async () => {
    await create(A1);
    await create(A2);
    const res = await send("delete", `/api/v1/addresses/${A1}`);

    expectNoContent(res);
    expect(await dbAddresses()).toEqual([{ id: A2, street: "Rua A", is_primary: false }]);
  });

  it("excluir um não principal mantém o principal", async () => {
    await create(A1);
    await create(A2);
    const res4 = await send("delete", `/api/v1/addresses/${A2}`);
    expectNoContent(res4);
    expect(res4.status).toBe(204);

    expect(await primaries()).toEqual([A1]);
  });

  it("depois de excluir o principal, um novo endereço com isPrimary omitido não é principal", async () => {
    await create(A1);
    await create(A2);
    await send("delete", `/api/v1/addresses/${A1}`);
    const res = await create(A3);

    expect(res.body).toMatchObject({ id: A3, isPrimary: false });
    expect(await primaries()).toEqual([]);
  });

  it("depois de excluir todos, o próximo endereço nasce principal", async () => {
    await create(A1);
    await send("delete", `/api/v1/addresses/${A1}`);
    const res = await create(A2, false);

    expect(res.body).toMatchObject({ id: A2, isPrimary: true });
  });

  it("C12 (A5): endereço inexistente dá 404 e não apaga os outros", async () => {
    await create(A1);
    const res5 = await send("delete", `/api/v1/addresses/${UNKNOWN_ADDRESS}`);
    expectNotFound(res5);
    expect(res5.status).toBe(404);

    expect(await dbAddresses()).toHaveLength(1);
  });

  it.each([
    ["malformado", "abc"],
    ["UUID v4", V4_ID],
  ])("C12 (A5): id %s dá 400 no parâmetro", async (_name, id) => {
    const res6 = await send("delete", `/api/v1/addresses/${id}`);
    expectValidationFailed(res6, ["param"]);
    expect(res6.status).toBe(400);
  });
});
