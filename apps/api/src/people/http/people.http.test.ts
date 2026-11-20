import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { App } from "supertest/types";
import { Module } from "@nestjs/common";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { PGlite } from "@electric-sql/pglite";
import { personListResponse, personResponse, problemSchema } from "@pilla/schemas";
import { configureApp } from "../../core/http/configure-app";
import { DATABASE } from "../../db/database";
import { migratedTestDb } from "../../db/test-db";
import type { MigratedTestDb } from "../../db/test-db";
import { PeopleModule } from "../people.module";

// IDs gerados pela API vêm de uma fila controlada pelo teste (relógio/gerador injetados).
const idQueue: string[] = [];
vi.mock("../../core/public/ids", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../core/public/ids")>();
  return {
    ...original,
    newId: (): string => {
      const next = idQueue.shift();
      if (next === undefined) throw new Error("fila de ids vazia");
      return next;
    },
  };
});

const ANA = "01970000-0000-7000-8000-000000000001";
const REFERRER = "01970000-0000-7000-8000-000000000002";
const THIRD = "01970000-0000-7000-8000-000000000003";
const UNKNOWN = "01970000-0000-7000-8000-000000000099";
const CPF_A = "52998224725";
const CPF_B = "11144477735";
const CPF_C = "39053344705";

const anaBody = { fullName: "Ana Costa", cpf: CPF_A, phone: "+5511987654321" };
const anaResponse = { id: ANA, fullName: "Ana Costa", cpf: CPF_A, phone: "+5511987654321", active: true, version: 1 };

const validationProblem = {
  title: "Validação falhou",
  status: 400,
  detail: "Dados inválidos.",
  code: "VALIDATION_FAILED",
};
const notFoundProblem = { title: "Não encontrado", status: 404, detail: "Recurso não encontrado.", code: "NOT_FOUND" };
const duplicateCpfProblem = {
  title: "DUPLICATE_CPF",
  status: 409,
  detail: "CPF já cadastrado.",
  code: "DUPLICATE_CPF",
};
const versionConflictProblem = {
  title: "VERSION_CONFLICT",
  status: 409,
  detail: "Versão desatualizada.",
  code: "VERSION_CONFLICT",
};

type FieldError = { field: string; message: string };
type ProblemBody = { code: string; errors?: FieldError[] };
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

function problem(res: request.Response): ProblemBody {
  return res.body as ProblemBody;
}

function fields(res: request.Response): string[] {
  return (problem(res).errors ?? []).map((e) => e.field);
}

@Module({})
class TestDatabaseModule {
  readonly kind = "test-database";
}

describe("people routes over Supertest", () => {
  let app: INestApplication;
  let handle: MigratedTestDb;
  let client: PGlite;

  const http = (): App => app.getHttpServer() as App;

  beforeAll(async () => {
    handle = await migratedTestDb();
    client = handle.client;

    const testDatabaseModule = {
      global: true,
      module: TestDatabaseModule,
      providers: [{ provide: DATABASE, useValue: handle.db }],
      exports: [DATABASE],
    };

    const moduleRef = await Test.createTestingModule({ imports: [testDatabaseModule, PeopleModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await handle.close();
  });

  beforeEach(async () => {
    idQueue.length = 0;
    await client.query("delete from people.persons");
  });

  const seed = async (
    id: string,
    fullName: string,
    cpf: string | null,
    options: { phone?: string; active?: boolean; version?: number } = {},
  ): Promise<void> => {
    await client.query(
      `insert into people.persons (id, full_name, cpf, phone, active, version) values ($1, $2, $3, $4, $5, $6)`,
      [id, fullName, cpf, options.phone ?? "+5511987654321", options.active ?? true, options.version ?? 1],
    );
  };

  const rowOf = async (id: string): Promise<PersonDbRow | undefined> => {
    const res = await client.query<PersonDbRow>(
      `select id, full_name, cpf, phone, email, birth_date::text as birth_date, referred_by_id, notes, active, version
       from people.persons where id = $1`,
      [id],
    );
    return res.rows[0];
  };

  const countOf = async (): Promise<number> => {
    const res = await client.query<{ n: number }>("select count(*)::int as n from people.persons");
    return res.rows[0]?.n ?? -1;
  };

  describe("POST /api/v1/people (C1-C4)", () => {
    it("C1 (A1): creates Ana with 201, Location and the basic body", async () => {
      idQueue.push(ANA);
      const res = await request(http()).post("/api/v1/people").send(anaBody);

      expect(res.status).toBe(201);
      expect(res.headers["content-type"]).toMatch(/^application\/json/);
      expect(res.headers["location"]).toBe(`/api/v1/people/${ANA}`);
      expect(res.body).toEqual(anaResponse);
      expect(personResponse.safeParse(res.body).success).toBe(true);
      expect(await rowOf(ANA)).toEqual({
        id: ANA,
        full_name: "Ana Costa",
        cpf: CPF_A,
        phone: "+5511987654321",
        email: null,
        birth_date: null,
        referred_by_id: null,
        notes: null,
        active: true,
        version: 1,
      });
    });

    it("C2 (A2): stores the trimmed name", async () => {
      idQueue.push(ANA);
      const res = await request(http())
        .post("/api/v1/people")
        .send({ ...anaBody, fullName: "  Ana Costa  " });

      expect(res.status).toBe(201);
      expect(res.body).toEqual(anaResponse);
      expect((await rowOf(ANA))?.full_name).toBe("Ana Costa");
    });

    it("C2 (A2): returns optional fields when informed", async () => {
      idQueue.push(ANA);
      const res = await request(http())
        .post("/api/v1/people")
        .send({ ...anaBody, email: "ana@example.com", birthDate: "1990-05-17", notes: "cliente antiga" });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({
        ...anaResponse,
        email: "ana@example.com",
        birthDate: "1990-05-17",
        notes: "cliente antiga",
      });
    });

    it.each([
      ["masked CPF", { cpf: "529.982.247-25" }, ["cpf"]],
      ["invalid CPF", { cpf: "11111111111" }, ["cpf"]],
      ["masked phone", { phone: "(11) 99999-0000" }, ["phone"]],
      ["empty name", { fullName: "" }, ["fullName"]],
      ["blank name", { fullName: "   " }, ["fullName"]],
      ["151-character name", { fullName: "a".repeat(151) }, ["fullName"]],
      ["invalid e-mail", { email: "nao-e-email" }, ["email"]],
      ["extra key", { active: false }, ["body"]],
    ])("C2 (A2): rejects %s with 400 VALIDATION_FAILED", async (_name, patch, expectedFields) => {
      const res = await request(http())
        .post("/api/v1/people")
        .send({ ...anaBody, ...patch });

      expect(res.status).toBe(400);
      expect(res.headers["content-type"]).toMatch(/^application\/problem\+json/);
      expect(res.body).toEqual({
        ...validationProblem,
        errors: expectedFields.map((field) => ({ field, message: expect.any(String) as string })),
      });
      expect(problemSchema.safeParse(res.body).success).toBe(true);
      expect(await countOf()).toBe(0);
    });

    it("C3 (A3): rejects a repeated CPF with 409 DUPLICATE_CPF", async () => {
      idQueue.push(ANA, REFERRER);
      await request(http()).post("/api/v1/people").send(anaBody).expect(201);

      const res = await request(http())
        .post("/api/v1/people")
        .send({ fullName: "Outra Pessoa", cpf: CPF_A, phone: "+5511912345678" });

      expect(res.status).toBe(409);
      expect(res.headers["content-type"]).toMatch(/^application\/problem\+json/);
      expect(res.body).toEqual(duplicateCpfProblem);
      const count = await client.query<{ n: number }>("select count(*)::int as n from people.persons where cpf = $1", [
        CPF_A,
      ]);
      expect(count.rows[0]?.n).toBe(1);
    });

    it("C4 (A4): stores referred_by_id when the referrer exists", async () => {
      await seed(REFERRER, "Indicador Silva", CPF_B);
      idQueue.push(ANA);

      const res = await request(http())
        .post("/api/v1/people")
        .send({ ...anaBody, referredById: REFERRER });

      expect(res.status).toBe(201);
      expect(res.body).toEqual(anaResponse);
      expect((await rowOf(ANA))?.referred_by_id).toBe(REFERRER);
    });

    it("C4 (A4): returns 404 NOT_FOUND when the referrer does not exist", async () => {
      idQueue.push(ANA, THIRD);
      await request(http()).post("/api/v1/people").send(anaBody).expect(201);

      const res = await request(http())
        .post("/api/v1/people")
        .send({ fullName: "Carla Dias", cpf: CPF_B, phone: "+5511912345678", referredById: REFERRER });

      expect(res.status).toBe(404);
      expect(res.headers["content-type"]).toMatch(/^application\/problem\+json/);
      expect(res.body).toEqual(notFoundProblem);
      expect(await countOf()).toBe(1);
    });
  });

  describe("GET /api/v1/people (C5-C7)", () => {
    it("C5 (A5): lists active people, including a null cpf, hiding inactive ones", async () => {
      await seed(ANA, "Ana Costa", CPF_A);
      await seed(REFERRER, "Beto Importado", null, { phone: "+5511900000002" });
      await seed(THIRD, "Zeca Inativo", CPF_B, { active: false });

      const res = await request(http()).get("/api/v1/people");

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        items: [
          { id: ANA, fullName: "Ana Costa", cpf: CPF_A, phone: "+5511987654321", active: true },
          { id: REFERRER, fullName: "Beto Importado", cpf: null, phone: "+5511900000002", active: true },
        ],
        nextCursor: null,
      });
      expect(personListResponse.safeParse(res.body).success).toBe(true);
    });

    it("C5 (A5): returns the empty page for an empty database", async () => {
      const res = await request(http()).get("/api/v1/people");

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ items: [], nextCursor: null });
    });

    describe("search (C6)", () => {
      beforeEach(async () => {
        await seed("01970000-0000-7000-8000-000000000011", "José Lima", CPF_A);
        await seed("01970000-0000-7000-8000-000000000012", "JOSE Santos", CPF_B);
        await seed("01970000-0000-7000-8000-000000000013", "Lote 529 Silva", CPF_C);
      });

      const item = (id: string, fullName: string, cpf: string): Record<string, unknown> => ({
        id,
        fullName,
        cpf,
        phone: "+5511987654321",
        active: true,
      });

      it("C6 (A6): jose ignores case and accents", async () => {
        const res = await request(http()).get("/api/v1/people").query({ search: "jose" });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
          items: [
            item("01970000-0000-7000-8000-000000000011", "José Lima", CPF_A),
            item("01970000-0000-7000-8000-000000000012", "JOSE Santos", CPF_B),
          ],
          nextCursor: null,
        });
      });

      it("C6 (A6): 529.982 matches only the CPF prefix", async () => {
        const res = await request(http()).get("/api/v1/people").query({ search: "529.982" });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
          items: [item("01970000-0000-7000-8000-000000000011", "José Lima", CPF_A)],
          nextCursor: null,
        });
      });

      it("C6 (A6): 529 unites name and CPF matches in name order", async () => {
        const res = await request(http()).get("/api/v1/people").query({ search: "529" });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
          items: [
            item("01970000-0000-7000-8000-000000000011", "José Lima", CPF_A),
            item("01970000-0000-7000-8000-000000000013", "Lote 529 Silva", CPF_C),
          ],
          nextCursor: null,
        });
      });

      it("C6 (A6): accented query finds the unaccented name", async () => {
        const res = await request(http()).get("/api/v1/people").query({ search: "JOSÉ" });

        expect(res.status).toBe(200);
        expect((res.body as { items: { fullName: string }[] }).items.map((i) => i.fullName)).toEqual([
          "José Lima",
          "JOSE Santos",
        ]);
      });
    });

    describe("pagination (C7)", () => {
      beforeEach(async () => {
        await seed("01970000-0000-7000-8000-000000000021", "Bia Nunes", CPF_A);
        await seed("01970000-0000-7000-8000-000000000022", "Davi Melo", CPF_B);
        await seed("01970000-0000-7000-8000-000000000023", "Eva Reis", CPF_C);
      });

      it("C7 (A7): walks the pages with limit=1 using the opaque cursor", async () => {
        const names: string[] = [];
        const cursors: (string | null)[] = [];
        let cursor: string | null = null;
        for (let page = 0; page < 3; page += 1) {
          const query: Record<string, string> = cursor === null ? { limit: "1" } : { limit: "1", cursor };
          const res = await request(http()).get("/api/v1/people").query(query);
          expect(res.status).toBe(200);
          const body = res.body as { items: { fullName: string }[]; nextCursor: string | null };
          expect(body.items).toHaveLength(1);
          names.push(body.items[0]?.fullName ?? "");
          cursors.push(body.nextCursor);
          cursor = body.nextCursor;
        }
        expect(names).toEqual(["Bia Nunes", "Davi Melo", "Eva Reis"]);
        expect(typeof cursors[0]).toBe("string");
        expect(typeof cursors[1]).toBe("string");
        expect(cursors[2]).toBeNull();
      });

      it("C7 (A7): uses limit 20 by default and accepts 100", async () => {
        const byDefault = await request(http()).get("/api/v1/people");
        expect((byDefault.body as { items: unknown[] }).items).toHaveLength(3);
        const max = await request(http()).get("/api/v1/people?limit=100");
        expect(max.status).toBe(200);
        expect((max.body as { items: unknown[] }).items).toHaveLength(3);
      });

      it.each(["0", "-1", "101", "1.5", "1e1", "", "abc"])("C7 (A7): rejects limit=%j", async (limit) => {
        const res = await request(http()).get(`/api/v1/people?limit=${limit}`);

        expect(res.status).toBe(400);
        expect(res.headers["content-type"]).toMatch(/^application\/problem\+json/);
        expect(problem(res).code).toBe("VALIDATION_FAILED");
        expect(fields(res)).toEqual(["limit"]);
        expect(problemSchema.safeParse(res.body).success).toBe(true);
      });

      it("C7 (A7): rejects a malformed cursor on the cursor field", async () => {
        const res = await request(http()).get("/api/v1/people?cursor=%25%25lixo");

        expect(res.status).toBe(400);
        expect(res.headers["content-type"]).toMatch(/^application\/problem\+json/);
        expect(problem(res).code).toBe("VALIDATION_FAILED");
        expect(fields(res)).toEqual(["cursor"]);
      });
    });
  });

  describe("GET /api/v1/people/:id (C8)", () => {
    it("C8 (A8): returns the basic body without aggregated data", async () => {
      await seed(ANA, "Ana Costa", CPF_A);

      const res = await request(http()).get(`/api/v1/people/${ANA}`);

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/^application\/json/);
      expect(res.body).toEqual(anaResponse);
      expect(personResponse.safeParse(res.body).success).toBe(true);
      expect(Object.keys(res.body as object).sort()).toEqual(
        ["active", "cpf", "fullName", "id", "phone", "version"].sort(),
      );
    });

    it("C8 (A8): returns 404 NOT_FOUND for an unknown id", async () => {
      await seed(ANA, "Ana Costa", CPF_A);
      await request(http()).get(`/api/v1/people/${ANA}`).expect(200);
      const res = await request(http()).get(`/api/v1/people/${UNKNOWN}`);

      expect(res.status).toBe(404);
      expect(res.headers["content-type"]).toMatch(/^application\/problem\+json/);
      expect(res.body).toEqual(notFoundProblem);
    });
  });

  describe("PATCH /api/v1/people/:id (C9-C11)", () => {
    const seedFull = async (version: number): Promise<void> => {
      await client.query(
        `insert into people.persons (id, full_name, cpf, phone, email, birth_date, notes, version)
         values ($1, 'Ana Costa', $2, '+5511987654321', 'ana@example.com', '1990-05-17', 'obs', $3)`,
        [ANA, CPF_A, version],
      );
    };

    it("C9 (A9): clears the optionals with null and bumps the version", async () => {
      await seedFull(3);

      const res = await request(http())
        .patch(`/api/v1/people/${ANA}`)
        .send({ version: 3, notes: null, email: null, birthDate: null });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ...anaResponse, version: 4 });
      expect(personResponse.safeParse(res.body).success).toBe(true);
      expect(await rowOf(ANA)).toEqual({
        id: ANA,
        full_name: "Ana Costa",
        cpf: CPF_A,
        phone: "+5511987654321",
        email: null,
        birth_date: null,
        referred_by_id: null,
        notes: null,
        active: true,
        version: 4,
      });
    });

    it("C9 (A9): changes only the informed fields", async () => {
      await seedFull(1);

      const res = await request(http()).patch(`/api/v1/people/${ANA}`).send({ version: 1, fullName: "Ana Maria" });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        ...anaResponse,
        fullName: "Ana Maria",
        email: "ana@example.com",
        birthDate: "1990-05-17",
        notes: "obs",
        version: 2,
      });
    });

    it.each([
      ["missing version", {}, ["version"]],
      ["negative version", { version: -1 }, ["version"]],
      ["fractional version", { version: 1.5 }, ["version"]],
      ["null cpf", { version: 1, cpf: null }, ["cpf"]],
      ["active", { version: 1, active: false }, ["body"]],
      ["referredById", { version: 1, referredById: REFERRER }, ["body"]],
    ])("C9 (A9): rejects %s with 400 VALIDATION_FAILED", async (_name, body, expectedFields) => {
      await seedFull(1);

      const res = await request(http()).patch(`/api/v1/people/${ANA}`).send(body);

      expect(res.status).toBe(400);
      expect(res.headers["content-type"]).toMatch(/^application\/problem\+json/);
      expect(problem(res).code).toBe("VALIDATION_FAILED");
      expect(fields(res)).toEqual(expectedFields);
      expect((await rowOf(ANA))?.version).toBe(1);
    });

    it("C9 (A9): returns 404 NOT_FOUND for an unknown id", async () => {
      await seedFull(1);
      await request(http()).patch(`/api/v1/people/${ANA}`).send({ version: 1, fullName: "Ana Maria" }).expect(200);
      const res = await request(http()).patch(`/api/v1/people/${UNKNOWN}`).send({ version: 1, fullName: "X Y" });

      expect(res.status).toBe(404);
      expect(res.headers["content-type"]).toMatch(/^application\/problem\+json/);
      expect(res.body).toEqual(notFoundProblem);
    });

    it("C10 (A10): returns 409 VERSION_CONFLICT for a stale version and keeps the row", async () => {
      await seed(ANA, "Ana Costa", CPF_A, { version: 2 });

      const res = await request(http())
        .patch(`/api/v1/people/${ANA}`)
        .send({ version: 1, fullName: "Nome não aplicado" });

      expect(res.status).toBe(409);
      expect(res.headers["content-type"]).toMatch(/^application\/problem\+json/);
      expect(res.body).toEqual(versionConflictProblem);
      const row = await rowOf(ANA);
      expect(row?.full_name).toBe("Ana Costa");
      expect(row?.version).toBe(2);
    });

    it("C10 (A10): returns 400 (not 428) when the version is missing", async () => {
      await seed(ANA, "Ana Costa", CPF_A, { version: 2 });

      const res = await request(http()).patch(`/api/v1/people/${ANA}`).send({ fullName: "Nome não aplicado" });

      expect(res.status).toBe(400);
      expect(problem(res).code).toBe("VALIDATION_FAILED");
      expect(fields(res)).toEqual(["version"]);
    });

    it("C11 (A11): returns 409 DUPLICATE_CPF when the CPF belongs to someone else", async () => {
      await seed(ANA, "Ana Costa", CPF_A);
      await seed(REFERRER, "Beto Dias", CPF_B);

      const res = await request(http()).patch(`/api/v1/people/${ANA}`).send({ version: 1, cpf: CPF_B });

      expect(res.status).toBe(409);
      expect(res.headers["content-type"]).toMatch(/^application\/problem\+json/);
      expect(res.body).toEqual(duplicateCpfProblem);
      const row = await rowOf(ANA);
      expect(row?.cpf).toBe(CPF_A);
      expect(row?.version).toBe(1);
    });
  });
});
