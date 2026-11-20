import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { HealthController } from "./health.controller";
import { configureApp } from "./configure-app";
import { DATABASE } from "../../db/database";
import type { DatabaseHandle } from "../../db/database";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { migratedTestDb } from "../../db/test-db";
import { healthResponseSchema } from "@pilla/schemas";
import type { App } from "supertest/types";

// `getHttpServer()` é tipado como any; aqui vira o tipo que o supertest aceita.
function httpServer(app: INestApplication): App {
  return app.getHttpServer() as App;
}

describe("HealthController (A8, A9)", () => {
  let app: INestApplication;
  let testDb: PgliteDatabase;
  let dbHandle: DatabaseHandle;

  beforeAll(async () => {
    const migrated = await migratedTestDb();
    testDb = migrated.db;
    dbHandle = migrated;

    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
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

  it("C22 (A8, unit): banco disponível devolve 200 {status: ok, database: up}", async () => {
    const res = await request(httpServer(app))
      .get("/api/v1/health")
      .expect(200)
      .expect("Content-Type", /application\/json/);

    expect(res.body).toEqual({ status: "ok", database: "up" });
    expect(healthResponseSchema.safeParse(res.body).success).toBe(true);
  });

  it("C23 (A9, unit): banco fechado devolve 200 {status: degraded, database: down}", async () => {
    await dbHandle.close();

    const res = await request(httpServer(app))
      .get("/api/v1/health")
      .expect(200)
      .expect("Content-Type", /application\/json/);

    expect(res.body).toEqual({ status: "degraded", database: "down" });
    expect(healthResponseSchema.safeParse(res.body).success).toBe(true);
    const text = JSON.stringify(res.body);
    expect(text).not.toContain("error");
    expect(text).not.toContain("Error");
  });
});
