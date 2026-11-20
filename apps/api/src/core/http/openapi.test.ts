import type { INestApplication } from "@nestjs/common";
import { healthResponseSchema, problemSchema } from "@pilla/schemas";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { buildOpenApiDocument, OpenApiController } from "./openapi";
import { createTestApp } from "./test-app";

let app: INestApplication;
beforeAll(async () => {
  app = await createTestApp([OpenApiController]);
});
afterAll(async () => {
  await app.close();
});

function refsOf(node: unknown): string[] {
  if (Array.isArray(node)) return node.flatMap(refsOf);
  if (node !== null && typeof node === "object") {
    return Object.entries(node).flatMap(([key, value]) => (key === "$ref" ? [String(value)] : refsOf(value)));
  }
  return [];
}

describe("OpenAPI gerado do zod", () => {
  it("monta o documento do contrato", () => {
    const doc = buildOpenApiDocument();
    expect(doc).toMatchObject({
      openapi: "3.1.0",
      info: { title: "pilla API", version: "0.1.0" },
      servers: [{ url: "/api/v1" }],
      paths: {
        "/health": {
          get: {
            operationId: "getHealth",
            responses: {
              "200": {
                content: { "application/json": { schema: { $ref: "#/components/schemas/HealthResponse" } } },
              },
              "500": {
                content: { "application/problem+json": { schema: { $ref: "#/components/schemas/Problem" } } },
              },
            },
          },
        },
      },
    });
  });

  it("gera os schemas com z.toJSONSchema e todo $ref resolve", () => {
    const doc = buildOpenApiDocument();
    const schemas = z.object({ components: z.object({ schemas: z.record(z.string(), z.unknown()) }) }).parse(doc)
      .components.schemas;
    expect(schemas["HealthResponse"]).toEqual(z.toJSONSchema(healthResponseSchema));
    expect(schemas["Problem"]).toEqual(z.toJSONSchema(problemSchema));
    const refs = refsOf(doc);
    expect(refs.length).toBeGreaterThan(0);
    expect(refs.every((ref) => ref.startsWith("#/components/schemas/") && ref.slice(21) in schemas)).toBe(true);
  });

  it("serve o mesmo documento em GET /api/v1/openapi.json", async () => {
    const res = await request(await app.getUrl()).get("/api/v1/openapi.json");
    const body: unknown = res.body;
    expect(res.status).toBe(200);
    expect(body).toEqual(JSON.parse(JSON.stringify(buildOpenApiDocument())));
  });
});
