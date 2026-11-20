import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { OpenApiController } from "./openapi";
import { HealthController } from "./health.controller";
import { configureApp } from "./configure-app";
import { DATABASE } from "../../db/database";
import { PgliteDatabase } from "drizzle-orm/pglite";
import { migratedTestDb } from "../../db/test-db";
import { z } from "zod";
import { healthResponseSchema, problemSchema } from "@pilla/schemas";
import { buildOpenApiDocument } from "./openapi";
import type { App } from "supertest/types";

// `getHttpServer()` é tipado como any; aqui vira o tipo que o supertest aceita.
function httpServer(app: INestApplication): App {
  return app.getHttpServer() as App;
}

type SchemaRef = { schema: { $ref: string } };
type OpenApiResponses = {
  "200": { content: { "application/json": SchemaRef } };
  "500": { content: { "application/problem+json": SchemaRef } };
};
type OpenApiBody = {
  openapi: string;
  info: unknown;
  servers: unknown;
  paths: { "/health": { get: { operationId: string; responses: OpenApiResponses } } };
  components: { schemas: Record<string, unknown> };
};

describe("OpenAPI (A12)", () => {
  let app: INestApplication;
  let testDb: PgliteDatabase;
  let dbHandle: Awaited<ReturnType<typeof migratedTestDb>>;

  beforeAll(async () => {
    const migrated = await migratedTestDb();
    testDb = migrated.db;
    dbHandle = migrated;

    const moduleRef = await Test.createTestingModule({
      controllers: [OpenApiController, HealthController],
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

  it("C28 (A12, unit): GET /api/v1/openapi.json corresponde ao documento do contrato", async () => {
    const res = await request(httpServer(app))
      .get("/api/v1/openapi.json")
      .expect(200)
      .expect("Content-Type", /application\/json/);

    const doc = res.body as OpenApiBody;

    expect(doc.openapi).toBe("3.1.0");
    expect(doc.info).toEqual({ title: "pilla API", version: "0.1.0" });
    expect(doc.servers).toEqual([{ url: "/api/v1" }]);

    expect(doc.paths["/health"]).toHaveProperty("get");
    expect(doc.paths["/health"].get).toHaveProperty("responses");
    expect(doc.paths["/health"].get.operationId).toBe("getHealth");

    const responses = doc.paths["/health"].get.responses;
    expect(responses).toHaveProperty("200");
    expect(responses["200"].content["application/json"].schema.$ref).toBe("#/components/schemas/HealthResponse");
    expect(responses).toHaveProperty("500");
    expect(responses["500"].content["application/problem+json"].schema.$ref).toBe("#/components/schemas/Problem");

    expect(doc.components.schemas.HealthResponse).toEqual(z.toJSONSchema(healthResponseSchema));
    expect(doc.components.schemas.Problem).toEqual(z.toJSONSchema(problemSchema));

    const refs = new Set<string>();
    function collectRefs(obj: unknown) {
      if (obj && typeof obj === "object") {
        if ("$ref" in obj && typeof obj.$ref === "string") {
          refs.add(obj.$ref);
        }
        for (const v of Object.values(obj)) collectRefs(v);
      }
    }
    collectRefs(doc);
    for (const ref of refs) {
      if (ref.startsWith("#/components/schemas/")) {
        const schemaName = ref.replace("#/components/schemas/", "");
        expect(Object.keys(doc.components.schemas)).toContain(schemaName);
      }
    }
  });

  it("C28 (A12, unit): buildOpenApiDocument() produz o mesmo documento", () => {
    const doc = buildOpenApiDocument();
    expect(doc.openapi).toBe("3.1.0");
    expect(doc.info).toEqual({ title: "pilla API", version: "0.1.0" });
    expect(doc.servers).toEqual([{ url: "/api/v1" }]);
    expect(doc.paths["/health"]).toHaveProperty("get");
    expect(doc.components.schemas.HealthResponse).toEqual(z.toJSONSchema(healthResponseSchema));
    expect(doc.components.schemas.Problem).toEqual(z.toJSONSchema(problemSchema));
  });
});
