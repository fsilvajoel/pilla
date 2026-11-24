import type { PGlite } from "@electric-sql/pglite";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { personDetailResponse, personListResponse, problemSchema } from "@pilla/schemas";
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

const ANA_ID = "01970000-0000-7000-8000-000000000001";
const REFERRER_ID = "01970000-0000-7000-8000-000000000002";
const SECOND_ID = "01970000-0000-7000-8000-000000000003";
const UNKNOWN_ID = "01970000-0000-7000-8000-000000000099";
const ANA_CPF = "52998224725";
const JOSE_CPF = "11144477735";
const LOTE_CPF = "39053344705";
const ANA_PHONE = "+5511987654321";
const OTHER_PHONE = "+5511987654322";

const env: ApiEnv = { host: "127.0.0.1", port: 3000, databaseUrl: "postgres://u:p@127.0.0.1:1/pilla" };

type SeedPerson = {
  id: string;
  fullName: string;
  cpf: string | null;
  phone?: string;
  active?: boolean;
  version?: number;
  email?: string;
  birthDate?: string;
  notes?: string;
};
type PersonDbRow = {
  id: string;
  full_name: string;
  cpf: string | null;
  phone: string;
  email: string | null;
  birth_date: string | null;
  referred_by_id: string | null;
  notes: string | null;
  active: boolean;
  version: number;
};

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
  await client.query("delete from people.persons");
});

afterEach(() => {
  idQueue.ids.length = 0;
});

async function seed(person: SeedPerson): Promise<void> {
  await client.query(
    `insert into people.persons (id, full_name, cpf, phone, active, version, email, birth_date, notes)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      person.id,
      person.fullName,
      person.cpf,
      person.phone ?? ANA_PHONE,
      person.active ?? true,
      person.version ?? 1,
      person.email ?? null,
      person.birthDate ?? null,
      person.notes ?? null,
    ],
  );
}

async function rowsById(id: string): Promise<PersonDbRow[]> {
  const result = await client.query<PersonDbRow>(
    `select id, full_name, cpf, phone, email, birth_date::text as birth_date, referred_by_id, notes, active, version
     from people.persons where id = $1`,
    [id],
  );
  return result.rows;
}

async function countAll(): Promise<number> {
  const result = await client.query<{ n: string }>("select count(*)::text as n from people.persons");
  return Number(result.rows[0]?.n ?? "-1");
}

function seedAna(version = 1): Promise<void> {
  return seed({ id: ANA_ID, fullName: "Ana Costa", cpf: ANA_CPF, version });
}

const anaBasic = { id: ANA_ID, fullName: "Ana Costa", cpf: ANA_CPF, phone: ANA_PHONE, active: true, version: 1 };

type Problem = { title: string; status: number; detail: string; code: string };
const notFoundProblem: Problem = {
  title: "Não encontrado",
  status: 404,
  detail: "Recurso não encontrado.",
  code: "NOT_FOUND",
};
const duplicateCpfProblem: Problem = {
  title: "DUPLICATE_CPF",
  status: 409,
  detail: "CPF já cadastrado.",
  code: "DUPLICATE_CPF",
};
const versionConflictProblem: Problem = {
  title: "VERSION_CONFLICT",
  status: 409,
  detail: "Versão desatualizada.",
  code: "VERSION_CONFLICT",
};

type HttpResult = { status: number; body: unknown; contentType: string; location: string | undefined };

async function send(method: "get" | "post" | "patch", path: string, body?: object): Promise<HttpResult> {
  const call = admin[method](path);
  const res = body === undefined ? await call : await call.send(body);
  const location: unknown = res.headers["location"];
  return {
    status: res.status,
    body: res.body as unknown,
    contentType: res.headers["content-type"] ?? "",
    location: typeof location === "string" ? location : undefined,
  };
}

function expectProblem(res: HttpResult, expected: Problem): void {
  expect(res.status).toBe(expected.status);
  expect(res.contentType).toMatch(/^application\/problem\+json/);
  expect(res.body).toEqual(expected);
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

const validBody = { fullName: "Ana Costa", cpf: ANA_CPF, phone: ANA_PHONE };

describe("POST /api/v1/people", () => {
  it("C1 (A1): cria com 201, Location e PersonResponse exato; opcionais ficam nulos no banco", async () => {
    idQueue.ids.push(ANA_ID);
    const res = await send("post", "/api/v1/people", validBody);

    expect(res.status).toBe(201);
    expect(res.contentType).toMatch(/^application\/json/);
    expect(res.location).toBe(`/api/v1/people/${ANA_ID}`);
    expect(res.body).toEqual(anaBasic);
    const rows = await rowsById(ANA_ID);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      active: true,
      version: 1,
      email: null,
      birth_date: null,
      referred_by_id: null,
      notes: null,
    });
  });

  it("C2 (A2): grava o nome aparado e devolve os opcionais informados", async () => {
    idQueue.ids.push(ANA_ID);
    const res = await send("post", "/api/v1/people", {
      ...validBody,
      fullName: "  Ana Costa  ",
      email: "ana@example.com",
      birthDate: "1990-01-31",
      notes: "  cliente antiga  ",
    });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      ...anaBasic,
      email: "ana@example.com",
      birthDate: "1990-01-31",
      notes: "cliente antiga",
    });
    expect((await rowsById(ANA_ID))[0]?.full_name).toBe("Ana Costa");
  });

  it("C2 (A2): CPF e telefone mascarados são normalizados para só dígitos (contrato E9-T04)", async () => {
    idQueue.ids.push(ANA_ID);
    const res = await send("post", "/api/v1/people", {
      ...validBody,
      cpf: "529.982.247-25",
      phone: "+55 (11) 98765-4321",
    });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(anaBasic);
  });

  const invalidCases: ReadonlyArray<readonly [string, object, string]> = [
    ["CPF com dígitos verificadores inválidos", { ...validBody, cpf: "11111111111" }, "cpf"],
    ["CPF com tamanho errado", { ...validBody, cpf: "123" }, "cpf"],
    ["telefone fora de E.164", { ...validBody, phone: "11987654321" }, "phone"],
    ["nome vazio", { ...validBody, fullName: "" }, "fullName"],
    ["nome só com espaços", { ...validBody, fullName: "   " }, "fullName"],
    ["nome com 151 caracteres", { ...validBody, fullName: "a".repeat(151) }, "fullName"],
    ["e-mail inválido", { ...validBody, email: "nao-e-email" }, "email"],
    ["propriedade extra", { ...validBody, extra: "x" }, "extra"],
    ["valor nulo em opcional do create", { ...validBody, notes: null }, "notes"],
  ];
  it.each(invalidCases)("C2 (A2): recusa %s com 400 VALIDATION_FAILED e o campo", async (_name, body, field) => {
    const res = await send("post", "/api/v1/people", body);

    expectValidationFailed(res, [field]);
    expect(await countAll()).toBe(0);
  });

  it("C2 (A2): lista exatamente os campos inválidos quando há mais de um", async () => {
    const res = await send("post", "/api/v1/people", { fullName: " ", cpf: "1", phone: "x" });

    expect(res.status).toBe(400);
    expectValidationFailed(res, ["fullName", "cpf", "phone"]);
  });

  it("C3 (A3): CPF repetido dá 409 DUPLICATE_CPF e não cria a segunda pessoa", async () => {
    idQueue.ids.push(ANA_ID, SECOND_ID);
    const first = await send("post", "/api/v1/people", validBody);
    const second = await send("post", "/api/v1/people", { ...validBody, fullName: "Outra Ana", phone: OTHER_PHONE });

    expect(first.status).toBe(201);
    expectProblem(second, duplicateCpfProblem);
    const count = await client.query<{ n: string }>("select count(*)::text as n from people.persons where cpf = $1", [
      ANA_CPF,
    ]);
    expect(count.rows[0]?.n).toBe("1");
    expect(await rowsById(SECOND_ID)).toHaveLength(0);
  });

  it("C4 (A4): indicador existente é gravado em referred_by_id", async () => {
    await seed({ id: REFERRER_ID, fullName: "Indicador Silva", cpf: JOSE_CPF });
    idQueue.ids.push(ANA_ID);
    const res = await send("post", "/api/v1/people", { ...validBody, referredById: REFERRER_ID });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(anaBasic);
    expect((await rowsById(ANA_ID))[0]?.referred_by_id).toBe(REFERRER_ID);
  });

  it("C4 (A4): indicador inexistente dá 404 NOT_FOUND e não cria a pessoa", async () => {
    idQueue.ids.push(ANA_ID);
    const ok = await send("post", "/api/v1/people", { ...validBody, cpf: JOSE_CPF });
    const res = await send("post", "/api/v1/people", { ...validBody, referredById: REFERRER_ID });

    expect(ok.status).toBe(201);
    expectProblem(res, notFoundProblem);
    expect(await countAll()).toBe(1);
  });
});

describe("GET /api/v1/people", () => {
  it("C5 (A5): lista só ativas, com cpf nulo para importada, exata e em ordem alfabética", async () => {
    await seed({ id: ANA_ID, fullName: "Ana Costa", cpf: ANA_CPF });
    await seed({ id: SECOND_ID, fullName: "Beto Importado", cpf: null, phone: OTHER_PHONE });
    await seed({ id: REFERRER_ID, fullName: "Caio Inativo", cpf: JOSE_CPF, active: false });
    const res = await send("get", "/api/v1/people");

    expect(res.status).toBe(200);
    expect(res.contentType).toMatch(/^application\/json/);
    expect(res.body).toEqual({
      items: [
        { id: ANA_ID, fullName: "Ana Costa", cpf: ANA_CPF, phone: ANA_PHONE, active: true },
        { id: SECOND_ID, fullName: "Beto Importado", cpf: null, phone: OTHER_PHONE, active: true },
      ],
      nextCursor: null,
    });
    expect(personListResponse.safeParse(res.body).success).toBe(true);
  });

  it("C5 (A5): banco vazio responde exatamente items vazio e nextCursor null", async () => {
    const res = await send("get", "/api/v1/people");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [], nextCursor: null });
  });

  describe("busca (C6)", () => {
    beforeEach(async () => {
      await seed({ id: ANA_ID, fullName: "José Lima", cpf: ANA_CPF });
      await seed({ id: SECOND_ID, fullName: "JOSE Santos", cpf: JOSE_CPF, phone: OTHER_PHONE });
      await seed({ id: REFERRER_ID, fullName: "Lote 529 Silva", cpf: LOTE_CPF, phone: "+5511987654323" });
    });

    async function names(search: string): Promise<string[] | null> {
      const res = await send("get", `/api/v1/people?search=${encodeURIComponent(search)}`);
      if (res.status !== 200) return null;
      const parsed = personListResponse.safeParse(res.body);
      return parsed.success ? parsed.data.items.map((item) => item.fullName) : null;
    }

    it("C6 (A6): 'jose' ignora caixa e acento e acha José Lima e JOSE Santos", async () => {
      expect(await names("jose")).toEqual(["JOSE Santos", "José Lima"]);
    });

    it("C6 (A6): busca com acento e caixa diferentes acha as mesmas pessoas", async () => {
      expect(await names("JOSÉ")).toEqual(["JOSE Santos", "José Lima"]);
    });

    it("C6 (A6): '529.982' casa só o CPF por prefixo, ignorando a pontuação", async () => {
      expect(await names("529.982")).toEqual(["José Lima"]);
    });

    it("C6 (A6): '529' une prefixo de CPF e trecho do nome, na ordem lower(nome), id", async () => {
      expect(await names("529")).toEqual(["José Lima", "Lote 529 Silva"]);
    });

    it("C6 (A6): busca mista de letra e dígito vale só como nome", async () => {
      expect(await names("lote 529")).toEqual(["Lote 529 Silva"]);
      expect(await names("jose 529")).toEqual([]);
    });

    it("C6 (A6): cada item traz exatamente id, fullName, cpf, phone e active", async () => {
      const res = await send("get", "/api/v1/people?search=529.982");

      expect(res.body).toEqual({
        items: [{ id: ANA_ID, fullName: "José Lima", cpf: ANA_CPF, phone: ANA_PHONE, active: true }],
        nextCursor: null,
      });
    });
  });

  describe("paginação (C7)", () => {
    beforeEach(async () => {
      await seed({ id: ANA_ID, fullName: "Bia Nunes", cpf: ANA_CPF });
      await seed({ id: SECOND_ID, fullName: "Davi Melo", cpf: JOSE_CPF, phone: OTHER_PHONE });
      await seed({ id: REFERRER_ID, fullName: "Eva Reis", cpf: LOTE_CPF, phone: "+5511987654323" });
    });

    it("C7 (A7): limit=1 percorre Bia, Davi e Eva com cursor opaco, sem repetir nem omitir", async () => {
      const page1 = await send("get", "/api/v1/people?limit=1");
      const body1 = personListResponse.parse(page1.body);
      expect(body1.items.map((item) => item.fullName)).toEqual(["Bia Nunes"]);
      expect(body1.nextCursor).not.toBeNull();

      const page2 = await send("get", `/api/v1/people?limit=1&cursor=${encodeURIComponent(body1.nextCursor ?? "")}`);
      const body2 = personListResponse.parse(page2.body);
      expect(body2.items.map((item) => item.fullName)).toEqual(["Davi Melo"]);
      expect(body2.nextCursor).not.toBeNull();

      const page3 = await send("get", `/api/v1/people?limit=1&cursor=${encodeURIComponent(body2.nextCursor ?? "")}`);
      const body3 = personListResponse.parse(page3.body);
      expect(body3.items.map((item) => item.fullName)).toEqual(["Eva Reis"]);
      expect(body3.nextCursor).toBeNull();
    });

    it("C7 (A7): sem limit usa 20 e limit=100 é aceito", async () => {
      const byDefault = await send("get", "/api/v1/people");
      const max = await send("get", "/api/v1/people?limit=100");

      expect(personListResponse.parse(byDefault.body).items).toHaveLength(3);
      expect(personListResponse.parse(max.body).items).toHaveLength(3);
    });

    const badLimits = ["0", "-1", "101", "1.5", "1e1", "", "abc"];
    it.each(badLimits)("C7 (A7): limit=%j dá 400 VALIDATION_FAILED no campo limit", async (limit) => {
      const res = await send("get", `/api/v1/people?limit=${encodeURIComponent(limit)}`);

      expect(res.status).toBe(400);
      expectValidationFailed(res, ["limit"]);
    });

    it("C7 (A7): cursor malformado dá 400 VALIDATION_FAILED no campo cursor", async () => {
      const res = await send("get", "/api/v1/people?cursor=isto-nao-e-cursor");

      expect(res.status).toBe(400);
      expectValidationFailed(res, ["cursor"]);
    });
  });
});

describe("GET /api/v1/people/:id", () => {
  const emptySheet = { referrer: null, referrals: [], addresses: [], pixKeys: [] };

  it("C8 (A8): devolve a ficha (personDetailResponse) exata, com agregados vazios", async () => {
    await seedAna();
    const res = await send("get", `/api/v1/people/${ANA_ID}`);

    expect(res.status).toBe(200);
    expect(res.contentType).toMatch(/^application\/json/);
    expect(personDetailResponse.safeParse(res.body).success).toBe(true);
    expect(res.body).toEqual({ ...anaBasic, ...emptySheet });
    expect(res.body).not.toHaveProperty("contracts");
  });

  it("C8 (A8): omite opcionais nulos e inclui os preenchidos", async () => {
    await seed({ id: ANA_ID, fullName: "Ana Costa", cpf: ANA_CPF, email: "ana@example.com", notes: "obs" });
    const res = await send("get", `/api/v1/people/${ANA_ID}`);

    expect(res.body).toEqual({ ...anaBasic, ...emptySheet, email: "ana@example.com", notes: "obs" });
    expect(res.body).not.toHaveProperty("birthDate");
  });

  it("C8 (A8): UUID desconhecido dá 404 NOT_FOUND", async () => {
    await seedAna();
    const found = await send("get", `/api/v1/people/${ANA_ID}`);
    const res = await send("get", `/api/v1/people/${UNKNOWN_ID}`);

    expect(found.status).toBe(200);
    expectProblem(res, notFoundProblem);
  });
});

describe("PATCH /api/v1/people/:id", () => {
  async function seedFull(version: number): Promise<void> {
    await seed({
      id: ANA_ID,
      fullName: "Ana Costa",
      cpf: ANA_CPF,
      version,
      email: "ana@example.com",
      birthDate: "1990-01-31",
      notes: "observação",
    });
  }

  it("C9 (A9): null limpa email, birthDate e notes, soma 1 na versão e os omite da resposta", async () => {
    await seedFull(3);
    const res = await send("patch", `/api/v1/people/${ANA_ID}`, {
      version: 3,
      notes: null,
      email: null,
      birthDate: null,
    });

    expect(res.status).toBe(200);
    expect(res.contentType).toMatch(/^application\/json/);
    expect(res.body).toEqual({ ...anaBasic, version: 4 });
    const row = (await rowsById(ANA_ID))[0];
    expect(row).toMatchObject({
      email: null,
      birth_date: null,
      notes: null,
      version: 4,
      cpf: ANA_CPF,
      phone: ANA_PHONE,
    });
  });

  it("C9 (A9): campo ausente não muda; campo informado muda", async () => {
    await seedFull(3);
    const res = await send("patch", `/api/v1/people/${ANA_ID}`, {
      version: 3,
      fullName: "  Ana Costa Souza  ",
      phone: OTHER_PHONE,
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ...anaBasic,
      fullName: "Ana Costa Souza",
      phone: OTHER_PHONE,
      email: "ana@example.com",
      birthDate: "1990-01-31",
      notes: "observação",
      version: 4,
    });
  });

  const invalidPatches: ReadonlyArray<readonly [string, object, string]> = [
    ["version negativa", { version: -1, fullName: "X" }, "version"],
    ["version não inteira", { version: 1.5, fullName: "X" }, "version"],
    ["cpf nulo", { version: 3, cpf: null }, "cpf"],
    ["campo active", { version: 3, active: false }, "active"],
    ["campo referredById", { version: 3, referredById: REFERRER_ID }, "referredById"],
    ["campo desconhecido", { version: 3, extra: "x" }, "extra"],
    ["CPF inválido", { version: 3, cpf: "11111111111" }, "cpf"],
  ];
  it.each(invalidPatches)(
    "C9 (A9): recusa %s com 400 VALIDATION_FAILED e não altera a linha",
    async (_name, body, field) => {
      await seedFull(3);
      const res = await send("patch", `/api/v1/people/${ANA_ID}`, body);

      expectValidationFailed(res, [field]);
      expect((await rowsById(ANA_ID))[0]).toMatchObject({ full_name: "Ana Costa", version: 3 });
    },
  );

  it("C9 (A9): PATCH de pessoa inexistente dá 404 NOT_FOUND", async () => {
    await seedFull(3);
    const ok = await send("patch", `/api/v1/people/${ANA_ID}`, { version: 3, fullName: "Ana Souza" });
    const res = await send("patch", `/api/v1/people/${UNKNOWN_ID}`, { version: 1, fullName: "Ninguém" });

    expect(ok.status).toBe(200);
    expectProblem(res, notFoundProblem);
  });

  it("C10 (A10): versão antiga dá 409 VERSION_CONFLICT e a linha não muda", async () => {
    await seedAna(2);
    const res = await send("patch", `/api/v1/people/${ANA_ID}`, { version: 1, fullName: "Nome não aplicado" });

    expectProblem(res, versionConflictProblem);
    expect((await rowsById(ANA_ID))[0]).toMatchObject({ full_name: "Ana Costa", version: 2 });
  });

  it("C10 (A10): sem version dá 400 VALIDATION_FAILED, não 428; If-Match não substitui o corpo", async () => {
    await seedAna(2);
    const res = await admin.patch(`/api/v1/people/${ANA_ID}`).set("If-Match", '"2"').send({ fullName: "X" });
    const body: unknown = res.body;

    expect(res.status).toBe(400);
    expect(res.headers["content-type"]).toMatch(/^application\/problem\+json/);
    expect(problemSchema.parse(body).code).toBe("VALIDATION_FAILED");
    expect(res.headers["etag"]).toBeUndefined();
  });

  it("C10 (A10): sucesso não devolve ETag", async () => {
    await seedAna(2);
    const res = await admin.patch(`/api/v1/people/${ANA_ID}`).send({ version: 2, fullName: "Ana Souza" });

    expect(res.status).toBe(200);
    expect(res.headers["etag"]).toBeUndefined();
  });

  it("C11 (A11): CPF de outra pessoa dá 409 DUPLICATE_CPF e mantém CPF e versão", async () => {
    await seedAna(1);
    await seed({ id: SECOND_ID, fullName: "José Lima", cpf: JOSE_CPF, phone: OTHER_PHONE });
    const res = await send("patch", `/api/v1/people/${ANA_ID}`, { version: 1, cpf: JOSE_CPF });

    expectProblem(res, duplicateCpfProblem);
    expect((await rowsById(ANA_ID))[0]).toMatchObject({ cpf: ANA_CPF, version: 1 });
  });
});
