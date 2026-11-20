import { Body, Controller, Get, Logger, Post, Query } from "@nestjs/common";
import type { INestApplication } from "@nestjs/common";
import { problemSchema } from "@pilla/schemas";
import fc from "fast-check";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ProblemException } from "./problem-exception";
import { createTestApp } from "./test-app";
import { ZodValidationPipe } from "./zod-validation.pipe";

const bodySchema = z.strictObject({ name: z.string().min(1), age: z.int().min(0).max(150) });
const querySchema = z.object({
  limit: z
    .string()
    .regex(/^[0-9]+$/)
    .transform((s) => Number.parseInt(s, 10))
    .pipe(z.int().min(1).max(100)),
});

@Controller("fixtures")
class FixtureController {
  @Post("echo")
  echo(@Body(new ZodValidationPipe(bodySchema)) body: z.infer<typeof bodySchema>): z.infer<typeof bodySchema> {
    return body;
  }

  @Get("list")
  list(@Query(new ZodValidationPipe(querySchema)) query: z.infer<typeof querySchema>): { limit: number } {
    return { limit: query.limit };
  }

  @Get("boom")
  boom(): never {
    throw new Error("senha=segredo-123");
  }

  @Get("throw")
  throwMessage(@Query("m") message: string): never {
    throw new Error(message);
  }

  @Get("conflict")
  conflict(): never {
    throw new ProblemException("VERSION_CONFLICT", "Versão desatualizada.");
  }

  @Get("conflict-fields")
  conflictFields(): never {
    throw new ProblemException("VALIDATION_FAILED", "Dados inválidos.", [{ field: "name", message: "Obrigatório." }]);
  }
}

let app: INestApplication;
const logError = vi.spyOn(Logger, "error").mockImplementation(() => undefined);

beforeAll(async () => {
  app = await createTestApp([FixtureController]);
});
afterAll(async () => {
  await app.close();
});
afterEach(() => {
  logError.mockClear();
});

function bodyOf(res: { body: unknown }): unknown {
  return res.body;
}

describe("400 VALIDATION_FAILED", () => {
  it("deixa o corpo válido passar", async () => {
    const res = await request(await app.getUrl())
      .post("/api/v1/fixtures/echo")
      .send({ name: "Ana", age: 30 });
    expect(res.status).toBe(201);
    expect(bodyOf(res)).toEqual({ name: "Ana", age: 30 });
  });

  it("responde problem+json com os campos recusados", async () => {
    const res = await request(await app.getUrl())
      .post("/api/v1/fixtures/echo")
      .send({});
    const body = bodyOf(res);
    expect(res.status).toBe(400);
    expect(res.headers["content-type"]).toMatch(/^application\/problem\+json/);
    expect(body).toMatchObject({
      title: "Validação falhou",
      status: 400,
      detail: "Dados inválidos.",
      code: "VALIDATION_FAILED",
    });
    expect(problemSchema.safeParse(body).success).toBe(true);
    expect(
      z
        .object({ errors: z.array(z.object({ field: z.string() })) })
        .parse(body)
        .errors.map((e) => e.field),
    ).toEqual(["name", "age"]);
  });

  it("devolve um item com o campo age quando a idade passa do limite", async () => {
    const res = await request(await app.getUrl())
      .post("/api/v1/fixtures/echo")
      .send({ name: "Ana", age: 151 });
    const body = z
      .object({ errors: z.array(z.object({ field: z.string(), message: z.string().min(1) })) })
      .parse(bodyOf(res));
    expect(res.status).toBe(400);
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0]?.field).toBe("age");
  });

  it.each(["0", "101", "%206%20", "1e1", "6.5", "-1", "abc", ""])("recusa ?limit=%s", async (limit) => {
    const res = await request(await app.getUrl()).get(`/api/v1/fixtures/list?limit=${limit}`);
    const body = z.object({ errors: z.array(z.object({ field: z.string() })) }).parse(bodyOf(res));
    expect(res.status).toBe(400);
    expect(body.errors[0]?.field).toBe("limit");
  });

  it.each(["1", "100"])("aceita ?limit=%s", async (limit) => {
    const res = await request(await app.getUrl()).get(`/api/v1/fixtures/list?limit=${limit}`);
    expect(res.status).toBe(200);
    expect(bodyOf(res)).toEqual({ limit: Number.parseInt(limit, 10) });
  });

  it("trata JSON malformado como VALIDATION_FAILED sem errors", async () => {
    const res = await request(await app.getUrl())
      .post("/api/v1/fixtures/echo")
      .set("Content-Type", "application/json")
      .send('{"name":');
    const body = bodyOf(res);
    expect(res.status).toBe(400);
    expect(res.headers["content-type"]).toMatch(/^application\/problem\+json/);
    expect(body).toMatchObject({ code: "VALIDATION_FAILED", title: "Validação falhou", detail: "Dados inválidos." });
    expect(body).not.toHaveProperty("errors");
    expect(problemSchema.safeParse(body).success).toBe(true);
  });
});

describe("404 NOT_FOUND", () => {
  it.each([
    ["get", "/api/v1/nao-existe"],
    ["get", "/fixtures/list"],
    ["post", "/api/v1/fixtures/list"],
  ] as const)("%s %s", async (method, path) => {
    const res = await request(await app.getUrl())[method](path);
    const body = bodyOf(res);
    expect(res.status).toBe(404);
    expect(res.headers["content-type"]).toMatch(/^application\/problem\+json/);
    expect(body).toEqual({
      title: "Não encontrado",
      status: 404,
      detail: "Recurso não encontrado.",
      code: "NOT_FOUND",
    });
  });
});

describe("500 INTERNAL_ERROR", () => {
  it("não vaza mensagem nem stack e registra no log", async () => {
    const res = await request(await app.getUrl()).get("/api/v1/fixtures/boom");
    expect(res.status).toBe(500);
    expect(res.headers["content-type"]).toMatch(/^application\/problem\+json/);
    expect(bodyOf(res)).toEqual({
      title: "Erro interno",
      status: 500,
      detail: "Erro interno do servidor.",
      code: "INTERNAL_ERROR",
    });
    expect(problemSchema.safeParse(bodyOf(res)).success).toBe(true);
    expect(res.text).not.toContain("segredo-123");
    expect(res.text).not.toMatch(/\n\s+at /);
    expect(res.text).not.toContain("stack");
    expect(logError.mock.calls.flat().map(String).join(" ")).toContain("senha=segredo-123");
  });

  it("nunca devolve a mensagem lançada", async () => {
    await fc.assert(
      fc.asyncProperty(fc.stringMatching(/^[0-9a-f]{12,24}$/), async (m) => {
        const res = await request(await app.getUrl())
          .get("/api/v1/fixtures/throw")
          .query({ m });
        expect(res.status).toBe(500);
        expect(problemSchema.safeParse(bodyOf(res)).success).toBe(true);
        expect(res.text).not.toContain(m);
      }),
      { numRuns: 25 },
    );
  });
});

describe("ProblemException", () => {
  it("leva o code do catálogo e o status dele", async () => {
    const res = await request(await app.getUrl()).get("/api/v1/fixtures/conflict");
    expect(res.status).toBe(409);
    expect(res.headers["content-type"]).toMatch(/^application\/problem\+json/);
    expect(bodyOf(res)).toEqual({
      title: "VERSION_CONFLICT",
      status: 409,
      detail: "Versão desatualizada.",
      code: "VERSION_CONFLICT",
    });
  });

  it("leva os errors informados no corpo", async () => {
    const res = await request(await app.getUrl()).get("/api/v1/fixtures/conflict-fields");
    expect(res.status).toBe(400);
    expect(bodyOf(res)).toMatchObject({ errors: [{ field: "name", message: "Obrigatório." }] });
  });
});
