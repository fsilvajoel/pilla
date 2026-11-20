import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { fc } from "@fast-check/vitest";
import request from "supertest";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { ProblemException } from "./problem-exception";
import { HttpException, HttpStatus, Logger } from "@nestjs/common";
import { ZodValidationPipe } from "./zod-validation.pipe";
import { z } from "zod";
import { Controller, Post, Get, Body, Query } from "@nestjs/common";
import { configureApp } from "./configure-app";
import { problemSchema } from "@pilla/schemas";
import { HealthController } from "./health.controller";
import { DATABASE } from "../../db/database";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import type { DatabaseHandle } from "../../db/database";
import { migratedTestDb } from "../../db/test-db";
import type { App } from "supertest/types";

// `getHttpServer()` é tipado como any; aqui vira o tipo que o supertest aceita.
function httpServer(app: INestApplication): App {
  return app.getHttpServer() as App;
}

type ProblemBody = { code: string; errors?: { field: string; message: string }[] };

function problemBody(res: request.Response): ProblemBody {
  return res.body as ProblemBody;
}

const fixtureBodySchema = z.strictObject({
  name: z.string().min(1),
  age: z.number().int().min(0).max(150),
});

const fixtureQuerySchema = z.strictObject({
  limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(100)),
});

@Controller("fixtures")
class FixtureController {
  @Post("echo")
  echo(@Body(new ZodValidationPipe(fixtureBodySchema)) body: z.infer<typeof fixtureBodySchema>) {
    return body;
  }

  @Get("list")
  list(@Query(new ZodValidationPipe(fixtureQuerySchema)) query: z.infer<typeof fixtureQuerySchema>) {
    return { limit: query.limit };
  }

  @Get("boom")
  boom() {
    throw new Error("senha=segredo-123");
  }

  // Lança a mensagem recebida na query, para exercitar mensagens variadas (C20).
  @Get("boom-message")
  boomMessage(@Query("msg") msg: string) {
    throw new Error(msg);
  }

  @Get("conflict-errors")
  conflictErrors() {
    throw new ProblemException("VERSION_CONFLICT", "Versão desatualizada.", [
      { field: "version", message: "Esperada a versão 3." },
    ]);
  }

  @Get("missing")
  missing() {
    throw new ProblemException("NOT_FOUND", "Cliente não encontrado.");
  }

  @Get("http-bad-request")
  httpBadRequest() {
    throw new HttpException("ruim", HttpStatus.BAD_REQUEST);
  }

  @Get("http-teapot")
  httpTeapot() {
    throw new HttpException("segredo-chaleira", HttpStatus.I_AM_A_TEAPOT);
  }

  @Get("throw-string")
  throwString() {
    // Valor que não é Error (tipado unknown para o lint aceitar o throw).
    const thrown: unknown = "texto-solto";
    throw thrown;
  }

  @Get("conflict")
  conflict() {
    throw new ProblemException("VERSION_CONFLICT", "Versão desatualizada.");
  }
}

describe("ProblemDetailsFilter over Supertest (A4-A7)", () => {
  let app: INestApplication;
  let testDb: PgliteDatabase;
  let dbHandle: DatabaseHandle;

  beforeAll(async () => {
    const migrated = await migratedTestDb();
    testDb = migrated.db;
    dbHandle = migrated;

    const moduleRef = await Test.createTestingModule({
      controllers: [FixtureController, HealthController],
      providers: [
        {
          provide: DATABASE,
          useValue: testDb,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await dbHandle.close();
  });

  describe("C12-C16 (A4): 400 VALIDATION_FAILED", () => {
    it("C12 (A4, unit): POST válido devolve 201 com o corpo", async () => {
      await request(httpServer(app))
        .post("/api/v1/fixtures/echo")
        .send({ name: "Ana", age: 30 })
        .expect(201)
        .expect({ name: "Ana", age: 30 });
    });

    it("C13 (A4, unit): POST vazio devolve 400 problem+json com errors", async () => {
      const res = await request(httpServer(app))
        .post("/api/v1/fixtures/echo")
        .send({})
        .expect(400)
        .expect("Content-Type", /application\/problem\+json/);

      expect(res.body).toEqual({
        title: "Validação falhou",
        status: 400,
        detail: "Dados inválidos.",
        code: "VALIDATION_FAILED",
        errors: [
          { field: "name", message: expect.any(String) as string },
          { field: "age", message: expect.any(String) as string },
        ],
      });
      expect(problemSchema.safeParse(res.body).success).toBe(true);
    });

    it("C14 (A4, unit): query limit inválido devolve 400 com field=limit", async () => {
      const invalidLimits = ["0", "101", " 6 ", "1e1", "6.5", "-1", "abc", ""];
      for (const limit of invalidLimits) {
        const res = await request(httpServer(app))
          .get(`/api/v1/fixtures/list?limit=${limit}`)
          .expect(400)
          .expect("Content-Type", /application\/problem\+json/);

        expect(problemBody(res).code).toBe("VALIDATION_FAILED");
        expect(problemBody(res).errors?.[0]?.field).toBe("limit");
        expect(problemSchema.safeParse(res.body).success).toBe(true);
      }

      const validLimits = ["1", "100"];
      for (const limit of validLimits) {
        await request(httpServer(app)).get(`/api/v1/fixtures/list?limit=${limit}`).expect(200);
      }
    });

    it("C15 (A4, unit): age 151 devolve 400 com errors só age", async () => {
      const res = await request(httpServer(app))
        .post("/api/v1/fixtures/echo")
        .send({ name: "Ana", age: 151 })
        .expect(400)
        .expect("Content-Type", /application\/problem\+json/);

      expect(problemBody(res).errors).toEqual([{ field: "age", message: expect.any(String) as string }]);
    });

    it("C16 (A4, unit): JSON malformado devolve 400 sem errors", async () => {
      const res = await request(httpServer(app))
        .post("/api/v1/fixtures/echo")
        .set("Content-Type", "application/json")
        .send('{"name":')
        .expect(400)
        .expect("Content-Type", /application\/problem\+json/);

      expect(res.body).toEqual({
        title: "Validação falhou",
        status: 400,
        detail: "Dados inválidos.",
        code: "VALIDATION_FAILED",
      });
      expect(problemBody(res).errors).toBeUndefined();
      expect(problemSchema.safeParse(res.body).success).toBe(true);
    });
  });

  describe("C17-C18 (A5): 404 NOT_FOUND", () => {
    it("C17 (A5, unit): rota inexistente devolve 404 problem+json", async () => {
      const res = await request(httpServer(app))
        .get("/api/v1/nao-existe")
        .expect(404)
        .expect("Content-Type", /application\/problem\+json/);

      expect(res.body).toEqual({
        title: "Não encontrado",
        status: 404,
        detail: "Recurso não encontrado.",
        code: "NOT_FOUND",
      });
      expect(problemSchema.safeParse(res.body).success).toBe(true);
    });

    it("C18 (A5, unit): rota sem prefixo e método errado devolvem 404", async () => {
      await request(httpServer(app))
        .get("/health")
        .expect(404)
        .expect("Content-Type", /application\/problem\+json/)
        .expect({ title: "Não encontrado", status: 404, detail: "Recurso não encontrado.", code: "NOT_FOUND" });

      await request(httpServer(app))
        .post("/api/v1/health")
        .expect(404)
        .expect("Content-Type", /application\/problem\+json/)
        .expect({ title: "Não encontrado", status: 404, detail: "Recurso não encontrado.", code: "NOT_FOUND" });
    });
  });

  describe("C19-C20 (A6): 500 INTERNAL_ERROR sem vazar", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("C19 (A6, unit): erro com segredo não vaza na resposta", async () => {
      const logSpy = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
      const res = await request(httpServer(app))
        .get("/api/v1/fixtures/boom")
        .expect(500)
        .expect("Content-Type", /application\/problem\+json/);

      expect(res.body).toEqual({
        title: "Erro interno",
        status: 500,
        detail: "Erro interno do servidor.",
        code: "INTERNAL_ERROR",
      });
      expect(problemSchema.safeParse(res.body).success).toBe(true);
      const text = JSON.stringify(res.body);
      expect(text).not.toContain("segredo-123");
      expect(text).not.toContain("stack");
      expect(text).not.toMatch(/\n\s+at /);
      // Log: só tipo e código (decisão do PM, 20/11); nenhum argumento carrega a mensagem do erro.
      expect(logSpy).toHaveBeenCalledTimes(1);
      const logged = logSpy.mock.calls.flat().map(String).join(" ");
      expect(logged).toContain("Error");
      expect(logged).toContain("INTERNAL_ERROR");
      expect(logged).not.toContain("segredo-123");
    });

    it("C20 (A6, prop): mensagens lançadas de verdade não vazam na resposta", async () => {
      await fc.assert(
        fc.asyncProperty(fc.stringMatching(/^seg-[0-9a-f]{8,12}$/), async (msg) => {
          const res = await request(httpServer(app))
            .get("/api/v1/fixtures/boom-message")
            .query({ msg })
            .expect(500)
            .expect("Content-Type", /application\/problem\+json/);

          expect(res.body).toEqual({
            title: "Erro interno",
            status: 500,
            detail: "Erro interno do servidor.",
            code: "INTERNAL_ERROR",
          });
          expect(problemSchema.safeParse(res.body).success).toBe(true);
          expect(res.text).not.toContain(msg);
        }),
        { numRuns: 15 },
      );
    });
  });

  describe("C21 (A7): ProblemException com code do catálogo", () => {
    it("C21 (A7, unit): VERSION_CONFLICT devolve 409 com code e detail", async () => {
      const res = await request(httpServer(app))
        .get("/api/v1/fixtures/conflict")
        .expect(409)
        .expect("Content-Type", /application\/problem\+json/);

      expect(res.body).toEqual({
        title: "VERSION_CONFLICT",
        status: 409,
        detail: "Versão desatualizada.",
        code: "VERSION_CONFLICT",
      });
      expect(problemSchema.safeParse(res.body).success).toBe(true);
    });
  });

  describe("C21 (A7) com errors", () => {
    it("C21 (A7, unit): code fora de VALIDATION_FAILED com errors informados leva os errors no corpo", async () => {
      const res = await request(httpServer(app))
        .get("/api/v1/fixtures/conflict-errors")
        .expect(409)
        .expect("Content-Type", /application\/problem\+json/);

      expect(res.body).toEqual({
        title: "VERSION_CONFLICT",
        status: 409,
        detail: "Versão desatualizada.",
        code: "VERSION_CONFLICT",
        errors: [{ field: "version", message: "Esperada a versão 3." }],
      });
      expect(problemSchema.safeParse(res.body).success).toBe(true);
    });
  });

  describe("C21b (A7): ramos restantes do filtro", () => {
    it("C21b (A7, unit): ProblemException NOT_FOUND mantém o detail da feature e o título padrão", async () => {
      const res = await request(httpServer(app))
        .get("/api/v1/fixtures/missing")
        .expect(404)
        .expect("Content-Type", /application\/problem\+json/);

      expect(res.body).toEqual({
        title: "Não encontrado",
        status: 404,
        detail: "Cliente não encontrado.",
        code: "NOT_FOUND",
      });
    });

    it("C21c (A7, unit): HttpException 400 vira VALIDATION_FAILED padrão", async () => {
      const res = await request(httpServer(app))
        .get("/api/v1/fixtures/http-bad-request")
        .expect(400)
        .expect("Content-Type", /application\/problem\+json/);

      expect(res.body).toEqual({
        title: "Validação falhou",
        status: 400,
        detail: "Dados inválidos.",
        code: "VALIDATION_FAILED",
      });
    });

    it("C21d (A7, unit): HttpException de outro status vira 500 sem vazar a mensagem", async () => {
      const res = await request(httpServer(app))
        .get("/api/v1/fixtures/http-teapot")
        .expect(500)
        .expect("Content-Type", /application\/problem\+json/);

      expect(res.body).toEqual({
        title: "Erro interno",
        status: 500,
        detail: "Erro interno do servidor.",
        code: "INTERNAL_ERROR",
      });
      expect(JSON.stringify(res.body)).not.toContain("segredo-chaleira");
    });

    it("C21e (A7, unit): valor lançado que não é Error vira 500 sem vazar o texto", async () => {
      const res = await request(httpServer(app))
        .get("/api/v1/fixtures/throw-string")
        .expect(500)
        .expect("Content-Type", /application\/problem\+json/);

      expect(res.body).toEqual({
        title: "Erro interno",
        status: 500,
        detail: "Erro interno do servidor.",
        code: "INTERNAL_ERROR",
      });
      expect(JSON.stringify(res.body)).not.toContain("texto-solto");
    });
  });
});
