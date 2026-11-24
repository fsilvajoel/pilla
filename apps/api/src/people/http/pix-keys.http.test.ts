import type { PGlite } from "@electric-sql/pglite";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { pixKeySchema, problemSchema } from "@pilla/schemas";
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
const K1 = "01970000-0000-7000-8000-000000000301";
const K2 = "01970000-0000-7000-8000-000000000302";
const K3 = "01970000-0000-7000-8000-000000000303";
const UNKNOWN_KEY = "01970000-0000-7000-8000-000000000399";

const env: ApiEnv = { host: "127.0.0.1", port: 3000, databaseUrl: "postgres://u:p@127.0.0.1:1/pilla" };

let client: PGlite;
let admin: AdminAgent;
let app: INestApplication;
let baseUrl: string;

beforeAll(async () => {
  const migrated = await migratedTestDb();
  client = migrated.client;
  const moduleRef = await Test.createTestingModule({ imports: [AppModule.forRoot(env)] })
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

type KeyDbRow = { id: string; owner_person_id: string; type: string; value: string; is_primary: boolean };

async function dbKeys(): Promise<KeyDbRow[]> {
  const result = await client.query<KeyDbRow>(
    "select id, owner_person_id, type, value, is_primary from people.pix_keys order by id",
  );
  return result.rows;
}

async function primaries(): Promise<string[]> {
  return (await dbKeys()).filter((row) => row.is_primary).map((row) => row.id);
}

async function create(id: string, isPrimary?: boolean, person = P1, value = "ana@example.com"): Promise<HttpResult> {
  idQueue.ids.push(id);
  return send("post", `/api/v1/people/${person}/pix-keys`, {
    type: "EMAIL",
    value,
    ...(isPrimary === undefined ? {} : { isPrimary }),
  });
}

describe("POST /api/v1/people/{id}/pix-keys", () => {
  it("C13 (A6): cria com 201, Location e corpo exato, valor aparado e principal", async () => {
    idQueue.ids.push(K1);
    const res = await send("post", `/api/v1/people/${P1}/pix-keys`, { type: "EMAIL", value: "  ana@example.com  " });

    expect(res.status).toBe(201);
    expect(res.contentType).toMatch(/^application\/json/);
    expect(res.location).toBe(`/api/v1/people/${P1}/pix-keys/${K1}`);
    expect(res.body).toEqual({ id: K1, type: "EMAIL", value: "ana@example.com", isPrimary: true });
    expect(pixKeySchema.safeParse(res.body).success).toBe(true);
    expect((await dbKeys())[0]).toMatchObject({ owner_person_id: P1, value: "ana@example.com" });
  });

  it.each(["CPF", "CNPJ", "EMAIL", "PHONE", "RANDOM"])("C14 (A8): aceita type %s com value aparado", async (type) => {
    idQueue.ids.push(K1);
    const res = await send("post", `/api/v1/people/${P1}/pix-keys`, { type, value: " 6 " });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: K1, type, value: "6", isPrimary: true });
  });

  it("aceita value de 140 caracteres sem validar formato por tipo", async () => {
    idQueue.ids.push(K1);
    const value = "x".repeat(140);
    const res = await send("post", `/api/v1/people/${P1}/pix-keys`, { type: "CPF", value });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ type: "CPF", value });
  });

  it("C15 (A7): a primeira chave nasce principal com isPrimary false; a segunda não toma o principal", async () => {
    const first = await create(K1, false);
    const second = await create(K2, false, P1, "b@example.com");

    expect(first.body).toMatchObject({ id: K1, isPrimary: true });
    expect(second.body).toMatchObject({ id: K2, isPrimary: false });
    expect(await primaries()).toEqual([K1]);
  });

  it("a segunda com isPrimary omitido não é principal", async () => {
    await create(K1);
    const res = await create(K2, undefined, P1, "b@example.com");

    expect(res.body).toMatchObject({ id: K2, isPrimary: false });
    expect(await primaries()).toEqual([K1]);
  });

  it("C16 (A7): isPrimary true na terceira desmarca as anteriores", async () => {
    await create(K1, false);
    await create(K2, false, P1, "b@example.com");
    const res = await create(K3, true, P1, "c@example.com");

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: K3, isPrimary: true });
    expect(await primaries()).toEqual([K3]);
  });

  it("o principal de uma pessoa não afeta o de outra", async () => {
    await create(K1, true, P1);
    const res = await create(K2, false, P2, "b@example.com");

    expect(res.body).toMatchObject({ id: K2, isPrimary: true });
    expect((await primaries()).sort()).toEqual([K1, K2]);
  });

  it("C21 (A5): pessoa inexistente dá 404 e não cria", async () => {
    idQueue.ids.push(K1);
    const res = await send("post", `/api/v1/people/${UNKNOWN_PERSON}/pix-keys`, { type: "EMAIL", value: "a@b.c" });

    expectNotFound(res);
    expect(await dbKeys()).toHaveLength(0);
  });

  it.each([
    ["malformado", "abc"],
    ["UUID v4", V4_ID],
  ])("C21 (A5): id de pessoa %s dá 400 no parâmetro", async (_name, id) => {
    const res1 = await send("post", `/api/v1/people/${id}/pix-keys`, { type: "EMAIL", value: "a@b.c" });
    expectValidationFailed(res1, ["param"]);
    expect(res1.status).toBe(400);
  });

  it("C22 (A9): chave repetida é aceita, na mesma pessoa e em outra, com 3 linhas", async () => {
    const first = await create(K1, undefined, P1);
    const second = await create(K2, undefined, P1);
    const third = await create(K3, undefined, P2);

    expect([first.status, second.status, third.status]).toEqual([201, 201, 201]);
    expect(first.body).toEqual({ id: K1, type: "EMAIL", value: "ana@example.com", isPrimary: true });
    expect(second.body).toEqual({ id: K2, type: "EMAIL", value: "ana@example.com", isPrimary: false });
    expect(third.body).toEqual({ id: K3, type: "EMAIL", value: "ana@example.com", isPrimary: true });
    const rows = await client.query(
      "select id from people.pix_keys where type = 'EMAIL' and value = 'ana@example.com'",
    );
    expect(rows.rows).toHaveLength(3);
  });

  it("C22 (A9): excluir todas as chaves deixa a pessoa com zero chaves", async () => {
    await create(K1);
    await create(K2);
    const res2 = await send("delete", `/api/v1/pix-keys/${K1}`);
    expectNoContent(res2);
    expect(res2.status).toBe(204);
    const res3 = await send("delete", `/api/v1/pix-keys/${K2}`);
    expectNoContent(res3);
    expect(res3.status).toBe(204);

    expect(await dbKeys()).toHaveLength(0);
  });
});

describe("POST pix-keys: validação (C20)", () => {
  const invalid: ReadonlyArray<[string, Record<string, unknown>, string]> = [
    ["type BANK", { type: "BANK" }, "type"],
    ["type minúsculo", { type: "email" }, "type"],
    ["type vazio", { type: "" }, "type"],
    ["type ALEATORIA", { type: "ALEATORIA" }, "type"],
    ["type não textual", { type: 5 }, "type"],
    ["value vazio", { value: "" }, "value"],
    ["value só espaços", { value: "   " }, "value"],
    ["value 141", { value: "x".repeat(141) }, "value"],
    ["value não textual", { value: 5 }, "value"],
    ["isPrimary texto", { isPrimary: "true" }, "isPrimary"],
    ["isPrimary nulo", { isPrimary: null }, "isPrimary"],
    ["isPrimary número", { isPrimary: 1 }, "isPrimary"],
    ["campo extra", { extra: 1 }, "extra"],
    ["version", { version: 1 }, "version"],
  ];

  it.each(invalid)("%s dá 400 VALIDATION_FAILED", async (_name, override, field) => {
    idQueue.ids.push(K1);
    const res = await send("post", `/api/v1/people/${P1}/pix-keys`, { type: "EMAIL", value: "a@b.c", ...override });

    expectValidationFailed(res, [field]);
    expect(await dbKeys()).toHaveLength(0);
  });

  it("corpo nulo dá 400", async () => {
    const res = await send("post", `/api/v1/people/${P1}/pix-keys`);

    expect(res.status).toBe(400);
    expect(res.contentType).toMatch(/^application\/problem\+json/);
  });
});

describe("PATCH /api/v1/pix-keys/{id}", () => {
  it("C17 (A7): isPrimary true transfere o principal", async () => {
    await create(K1, false);
    await create(K2, false, P1, "b@example.com");
    await create(K3, true, P1, "c@example.com");
    const res = await send("patch", `/api/v1/pix-keys/${K2}`, { isPrimary: true });

    expect(res.status).toBe(200);
    expect(res.contentType).toMatch(/^application\/json/);
    expect(res.body).toEqual({ id: K2, type: "EMAIL", value: "b@example.com", isPrimary: true });
    expect(pixKeySchema.safeParse(res.body).success).toBe(true);
    expect(await primaries()).toEqual([K2]);
  });

  it("altera type e value apara o valor, preservando o resto", async () => {
    await create(K1);
    const res = await send("patch", `/api/v1/pix-keys/${K1}`, { type: "PHONE", value: " +5511999990000 " });

    expect(res.body).toEqual({ id: K1, type: "PHONE", value: "+5511999990000", isPrimary: true });
    expect((await dbKeys())[0]).toMatchObject({ type: "PHONE", value: "+5511999990000" });
  });

  it("C18 (A7): {} é no-op e devolve a mesma representação", async () => {
    await create(K1);
    await create(K2, undefined, P1, "b@example.com");
    const res = await send("patch", `/api/v1/pix-keys/${K2}`, {});

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: K2, type: "EMAIL", value: "b@example.com", isPrimary: false });
    expect(await primaries()).toEqual([K1]);
  });

  it("C18 (A7): isPrimary false no principal não promove outro", async () => {
    await create(K1);
    await create(K2, undefined, P1, "b@example.com");
    const res = await send("patch", `/api/v1/pix-keys/${K1}`, { isPrimary: false });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: K1, isPrimary: false });
    expect(await primaries()).toEqual([]);
  });

  it("isPrimary false em quem não é principal não mexe no principal", async () => {
    await create(K1);
    await create(K2, undefined, P1, "b@example.com");
    await send("patch", `/api/v1/pix-keys/${K2}`, { isPrimary: false });

    expect(await primaries()).toEqual([K1]);
  });

  it("trocar o principal em uma pessoa não afeta a outra", async () => {
    await create(K1, true, P1);
    await create(K2, true, P2, "b@example.com");
    await create(K3, false, P1, "c@example.com");
    await send("patch", `/api/v1/pix-keys/${K3}`, { isPrimary: true });

    expect((await primaries()).sort()).toEqual([K2, K3]);
  });

  it("alterar para um valor igual ao de outra chave é aceito", async () => {
    await create(K1);
    await create(K2, undefined, P1, "b@example.com");
    const res = await send("patch", `/api/v1/pix-keys/${K2}`, { value: "ana@example.com" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: K2, value: "ana@example.com" });
  });

  it("C21 (A5): chave inexistente dá 404", async () => {
    const res4 = await send("patch", `/api/v1/pix-keys/${UNKNOWN_KEY}`, { value: "x" });
    expectNotFound(res4);
    expect(res4.status).toBe(404);
    const res5 = await send("patch", `/api/v1/pix-keys/${UNKNOWN_KEY}`, {});
    expectNotFound(res5);
    expect(res5.status).toBe(404);
  });

  it.each([
    ["malformado", "abc"],
    ["UUID v4", V4_ID],
  ])("C21 (A5): id %s dá 400 no parâmetro", async (_name, id) => {
    const res6 = await send("patch", `/api/v1/pix-keys/${id}`, { value: "x" });
    expectValidationFailed(res6, ["param"]);
    expect(res6.status).toBe(400);
  });

  it.each([
    ["type BANK", { type: "BANK" }, "type"],
    ["value vazio", { value: "" }, "value"],
    ["value 141", { value: "x".repeat(141) }, "value"],
    ["isPrimary nulo", { isPrimary: null }, "isPrimary"],
    ["campo extra", { extra: 1 }, "extra"],
    ["version", { version: 1 }, "version"],
  ] as const)("C20 (A8): %s dá 400 e não altera", async (_name, body, field) => {
    await create(K1);
    const res = await send("patch", `/api/v1/pix-keys/${K1}`, body);

    expectValidationFailed(res, [field]);
    expect((await dbKeys())[0]).toMatchObject({ type: "EMAIL", value: "ana@example.com" });
  });
});

describe("DELETE /api/v1/pix-keys/{id}", () => {
  it("C19 (A7): excluir o principal dá 204 sem corpo e a restante continua não principal", async () => {
    await create(K1);
    await create(K2, undefined, P1, "b@example.com");
    const res = await send("delete", `/api/v1/pix-keys/${K1}`);

    expectNoContent(res);
    expect(await dbKeys()).toEqual([
      { id: K2, owner_person_id: P1, type: "EMAIL", value: "b@example.com", is_primary: false },
    ]);
  });

  it("excluir um não principal mantém o principal", async () => {
    await create(K1);
    await create(K2, undefined, P1, "b@example.com");
    const res7 = await send("delete", `/api/v1/pix-keys/${K2}`);
    expectNoContent(res7);
    expect(res7.status).toBe(204);

    expect(await primaries()).toEqual([K1]);
  });

  it("depois de excluir todas, a próxima chave nasce principal", async () => {
    await create(K1);
    await send("delete", `/api/v1/pix-keys/${K1}`);
    const res = await create(K2, false);

    expect(res.body).toMatchObject({ id: K2, isPrimary: true });
  });

  it("C21 (A5): chave inexistente dá 404 e não apaga as outras", async () => {
    await create(K1);
    const res8 = await send("delete", `/api/v1/pix-keys/${UNKNOWN_KEY}`);
    expectNotFound(res8);
    expect(res8.status).toBe(404);

    expect(await dbKeys()).toHaveLength(1);
  });

  it.each([
    ["malformado", "abc"],
    ["UUID v4", V4_ID],
  ])("C21 (A5): id %s dá 400 no parâmetro", async (_name, id) => {
    const res9 = await send("delete", `/api/v1/pix-keys/${id}`);
    expectValidationFailed(res9, ["param"]);
    expect(res9.status).toBe(400);
  });
});
