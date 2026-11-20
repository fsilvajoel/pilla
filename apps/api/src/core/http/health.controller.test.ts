import { healthResponseSchema } from "@pilla/schemas";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { DATABASE } from "../../db/database";
import { migratedTestDb } from "../../db/test-db";
import { HealthController } from "./health.controller";
import { createTestApp } from "./test-app";

let app: INestApplication | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe("GET /api/v1/health", () => {
  it("responde ok/up com o banco disponível", async () => {
    const { db } = await migratedTestDb();
    app = await createTestApp([HealthController], [{ provide: DATABASE, useValue: db }]);
    const res = await request(await app.getUrl()).get("/api/v1/health");
    const body: unknown = res.body;
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/^application\/json/);
    expect(body).toEqual({ status: "ok", database: "up" });
    expect(healthResponseSchema.safeParse(body).success).toBe(true);
  });

  it("responde 200 degraded/down com o banco fechado, sem detalhe do erro", async () => {
    const { db, client } = await migratedTestDb();
    await client.close();
    app = await createTestApp([HealthController], [{ provide: DATABASE, useValue: db }]);
    const res = await request(await app.getUrl()).get("/api/v1/health");
    const body: unknown = res.body;
    expect(res.status).toBe(200);
    expect(body).toEqual({ status: "degraded", database: "down" });
    expect(res.text).not.toMatch(/closed|PGlite|select/i);
  });
});
