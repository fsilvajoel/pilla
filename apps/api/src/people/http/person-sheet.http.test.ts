import type { PGlite } from "@electric-sql/pglite";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { personDetailResponse, problemSchema } from "@pilla/schemas";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { type AdminAgent, loginAsAdmin } from "../../core/http/test-admin-agent";
import { AppModule } from "../../app.module";
import { configureApp } from "../../core/http/configure-app";
import type { ApiEnv } from "../../core/http/env";
import { DATABASE_HANDLE } from "../../db/database";
import { migratedTestDb } from "../../db/test-db";

const ANA_ID = "01970000-0000-7000-8000-000000000001";
const CARLOS_ID = "01970000-0000-7000-8000-000000000002";
const BRUNO_ID = "01970000-0000-7000-8000-000000000003";
const DIANA_ID = "01970000-0000-7000-8000-000000000004";
const INACTIVE_ID = "01970000-0000-7000-8000-000000000005";
const UNKNOWN_ID = "01970000-0000-7000-8000-000000000099";
const UUID_V4 = "550e8400-e29b-41d4-a716-446655440000";
const ADDRESS_1 = "01970000-0000-7000-8000-000000000010";
const ADDRESS_2 = "01970000-0000-7000-8000-000000000011";
const PIX_1 = "01970000-0000-7000-8000-000000000012";
const PIX_2 = "01970000-0000-7000-8000-000000000013";

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
  await client.query("delete from people.addresses");
  await client.query("delete from people.pix_keys");
  await client.query("update people.persons set referred_by_id = null");
  await client.query("delete from people.persons");
});

afterEach(() => {
  vi.restoreAllMocks();
});

type SeedPerson = {
  id: string;
  fullName: string;
  cpf: string | null;
  phone: string;
  active?: boolean;
  referredById?: string;
};

async function seedPerson(person: SeedPerson): Promise<void> {
  await client.query(
    `insert into people.persons (id, full_name, cpf, phone, active, referred_by_id)
     values ($1, $2, $3, $4, $5, $6)`,
    [person.id, person.fullName, person.cpf, person.phone, person.active ?? true, person.referredById ?? null],
  );
}

const ana: SeedPerson = { id: ANA_ID, fullName: "Ana Costa", cpf: "52998224725", phone: "+5511987654321" };
const carlos: SeedPerson = { id: CARLOS_ID, fullName: "Carlos Moraes", cpf: "11144477735", phone: "+5511987654302" };
const bruno: SeedPerson = {
  id: BRUNO_ID,
  fullName: "Bruno Lima",
  cpf: "39053344705",
  phone: "+5511987654303",
  referredById: ANA_ID,
};
const diana: SeedPerson = {
  id: DIANA_ID,
  fullName: "Diana Souza",
  cpf: "12345678909",
  phone: "+5511987654304",
  referredById: ANA_ID,
};

async function seedAddress(id: string, isPrimary: boolean, createdAt: string): Promise<void> {
  const second = id === ADDRESS_2;
  await client.query(
    `insert into people.addresses
       (id, person_id, street, number, complement, district, city, state, postal_code, is_primary, created_at)
     values ($1, $2, $3, $4, $5, $6, 'São Paulo', 'SP', $7, $8, $9)`,
    [
      id,
      ANA_ID,
      second ? "Rua do Comércio" : "Rua das Flores",
      second ? "45" : "123",
      second ? null : "Apto 12",
      second ? "Bela Vista" : "Centro",
      second ? "01310100" : "01001000",
      isPrimary,
      createdAt,
    ],
  );
}

async function seedPix(id: string, isPrimary: boolean, createdAt: string): Promise<void> {
  const second = id === PIX_2;
  await client.query(
    `insert into people.pix_keys (id, owner_person_id, type, value, is_primary, created_at)
     values ($1, $2, $3, $4, $5, $6)`,
    [id, ANA_ID, second ? "EMAIL" : "PHONE", second ? "ana@example.com" : "+5511987654321", isPrimary, createdAt],
  );
}

const address1 = {
  id: ADDRESS_1,
  street: "Rua das Flores",
  number: "123",
  complement: "Apto 12",
  district: "Centro",
  city: "São Paulo",
  state: "SP",
  postalCode: "01001000",
};
const address2 = {
  id: ADDRESS_2,
  street: "Rua do Comércio",
  number: "45",
  district: "Bela Vista",
  city: "São Paulo",
  state: "SP",
  postalCode: "01310100",
};
const pix1 = { id: PIX_1, type: "PHONE", value: "+5511987654321" };
const pix2 = { id: PIX_2, type: "EMAIL", value: "ana@example.com" };

const anaBase = {
  id: ANA_ID,
  fullName: "Ana Costa",
  cpf: "52998224725",
  phone: "+5511987654321",
  active: true,
  version: 1,
};
const carlosSummary = {
  id: CARLOS_ID,
  fullName: "Carlos Moraes",
  cpf: "11144477735",
  phone: "+5511987654302",
  active: true,
};
const brunoSummary = {
  id: BRUNO_ID,
  fullName: "Bruno Lima",
  cpf: "39053344705",
  phone: "+5511987654303",
  active: true,
};
const dianaSummary = {
  id: DIANA_ID,
  fullName: "Diana Souza",
  cpf: "12345678909",
  phone: "+5511987654304",
  active: true,
};

const T1 = "2026-01-01T10:00:00-03:00";
const T2 = "2026-01-02T10:00:00-03:00";
const T3 = "2026-01-03T10:00:00-03:00";
const T4 = "2026-01-04T10:00:00-03:00";

type HttpResult = { status: number; body: unknown; contentType: string };

async function getSheet(id: string): Promise<HttpResult> {
  const res = await admin.get(`/api/v1/people/${id}`);
  return { status: res.status, body: res.body as unknown, contentType: res.headers["content-type"] ?? "" };
}

function expectJson(res: HttpResult): void {
  expect(res.status).toBe(200);
  expect(res.contentType).toMatch(/^application\/json/);
  expect(personDetailResponse.safeParse(res.body).success).toBe(true);
}

describe("GET /api/v1/people/:id (ficha)", () => {
  it("C1 (A1): pessoa sem relacionamentos devolve a ficha vazia, sem opcionais e sem contracts", async () => {
    await seedPerson(ana);
    const res = await getSheet(ANA_ID);

    expectJson(res);
    expect(res.body).toEqual({ ...anaBase, referrer: null, referrals: [], addresses: [], pixKeys: [] });
    for (const absent of ["email", "birthDate", "notes", "contracts"]) {
      expect(res.body).not.toHaveProperty(absent);
    }
  });

  it("C2 (A2): ficha completa com indicador, indicados e listas com principal primeiro", async () => {
    await seedPerson(carlos);
    await seedPerson({ ...ana, referredById: CARLOS_ID });
    await seedPerson(diana);
    await seedPerson(bruno);
    await seedAddress(ADDRESS_1, false, T1);
    await seedAddress(ADDRESS_2, true, T2);
    await seedPix(PIX_1, false, T3);
    await seedPix(PIX_2, true, T4);
    const res = await getSheet(ANA_ID);

    expectJson(res);
    expect(res.body).toEqual({
      ...anaBase,
      referrer: carlosSummary,
      referrals: [brunoSummary, dianaSummary],
      addresses: [
        { ...address2, isPrimary: true },
        { ...address1, isPrimary: false },
      ],
      pixKeys: [
        { ...pix2, isPrimary: true },
        { ...pix1, isPrimary: false },
      ],
    });
    expect(res.body).not.toHaveProperty("contracts");
  });

  it("C3 (A3): sem principal, ordena por createdAt e id e mantém isPrimary false", async () => {
    await seedPerson(ana);
    await seedAddress(ADDRESS_2, false, T2);
    await seedAddress(ADDRESS_1, false, T1);
    await seedPix(PIX_2, false, T4);
    await seedPix(PIX_1, false, T3);
    const res = await getSheet(ANA_ID);

    expectJson(res);
    expect(res.body).toEqual({
      ...anaBase,
      referrer: null,
      referrals: [],
      addresses: [
        { ...address1, isPrimary: false },
        { ...address2, isPrimary: false },
      ],
      pixKeys: [
        { ...pix1, isPrimary: false },
        { ...pix2, isPrimary: false },
      ],
    });
  });

  it("C3 (A3): createdAt igual desempata pelo id", async () => {
    await seedPerson(ana);
    await seedAddress(ADDRESS_2, false, T1);
    await seedAddress(ADDRESS_1, false, T1);
    const res = await getSheet(ANA_ID);

    expectJson(res);
    expect(res.body).toMatchObject({
      addresses: [
        { id: ADDRESS_1, isPrimary: false },
        { id: ADDRESS_2, isPrimary: false },
      ],
    });
  });

  it("C4 (A4): pessoa inativa sem opcionais mantém active false e listas vazias", async () => {
    await seedPerson({
      id: INACTIVE_ID,
      fullName: "Ana Inativa",
      cpf: "52998224725",
      phone: "+5511987654321",
      active: false,
    });
    const res = await getSheet(INACTIVE_ID);

    expectJson(res);
    expect(res.body).toEqual({
      id: INACTIVE_ID,
      fullName: "Ana Inativa",
      cpf: "52998224725",
      phone: "+5511987654321",
      active: false,
      version: 1,
      referrer: null,
      referrals: [],
      addresses: [],
      pixKeys: [],
    });
    for (const absent of ["email", "birthDate", "notes"]) {
      expect(res.body).not.toHaveProperty(absent);
    }
  });

  it("C4 (A4): indicado importado tem cpf null só no resumo e indicador inativo mantém active false", async () => {
    await seedPerson({ ...carlos, active: false });
    await seedPerson({ ...ana, referredById: CARLOS_ID });
    await seedPerson({ ...bruno, cpf: null });
    const res = await getSheet(ANA_ID);

    expectJson(res);
    expect(res.body).toEqual({
      ...anaBase,
      referrer: { ...carlosSummary, active: false },
      referrals: [{ ...brunoSummary, cpf: null }],
      addresses: [],
      pixKeys: [],
    });
  });

  it("C5 (A5): UUID v4 e texto dão 400 VALIDATION_FAILED", async () => {
    await seedPerson(ana);
    expectJson(await getSheet(ANA_ID));
    for (const id of [UUID_V4, "nao-e-uuid"]) {
      const res = await getSheet(id);

      expect(res.status).toBe(400);
      expect(res.contentType).toMatch(/^application\/problem\+json/);
      expect(res.body).toMatchObject({
        title: "Validação falhou",
        status: 400,
        detail: "Dados inválidos.",
        code: "VALIDATION_FAILED",
      });
      expect(problemSchema.safeParse(res.body).success).toBe(true);
    }
  });

  it("C5 (A5): UUID v7 inexistente dá 404 NOT_FOUND exato", async () => {
    await seedPerson(ana);
    expectJson(await getSheet(ANA_ID));
    const res = await getSheet(UNKNOWN_ID);

    expect(res.status).toBe(404);
    expect(res.contentType).toMatch(/^application\/problem\+json/);
    expect(res.body).toEqual({
      title: "Não encontrado",
      status: 404,
      detail: "Recurso não encontrado.",
      code: "NOT_FOUND",
    });
  });

  it("C6 (A6): ficha completa usa no máximo 4 consultas", async () => {
    await seedPerson(carlos);
    await seedPerson({ ...ana, referredById: CARLOS_ID });
    await seedPerson(bruno);
    await seedPerson(diana);
    await seedAddress(ADDRESS_1, true, T1);
    await seedAddress(ADDRESS_2, false, T2);
    await seedPix(PIX_1, true, T3);
    await seedPix(PIX_2, false, T4);
    const spy = vi.spyOn(client, "query");
    const res = await getSheet(ANA_ID);

    expectJson(res);
    const sheetQueries = spy.mock.calls.filter((call) => !JSON.stringify(call[0]).includes('\\"access\\"'));
    expect(sheetQueries.length).toBeGreaterThan(0);
    expect(sheetQueries.length).toBeLessThanOrEqual(4);
  });

  it("C6 (A6): ficha sem relacionamentos usa no máximo 4 consultas", async () => {
    await seedPerson(ana);
    const spy = vi.spyOn(client, "query");
    const res = await getSheet(ANA_ID);

    expectJson(res);
    const sheetQueries = spy.mock.calls.filter((call) => !JSON.stringify(call[0]).includes('\\"access\\"'));
    expect(sheetQueries.length).toBeGreaterThan(0);
    expect(sheetQueries.length).toBeLessThanOrEqual(4);
  });
});
