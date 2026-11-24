import { createServer } from "node:net";
import { Logger, type INestApplication } from "@nestjs/common";
import { healthResponseSchema, problemSchema } from "@pilla/schemas";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppModule } from "./app.module";
import { configureApp } from "./core/http/configure-app";
import type { ApiEnv } from "./core/http/env";
import { createDatabase, DATABASE_HANDLE } from "./db/database";
import { migratedTestDb } from "./db/test-db";
import { bootstrap } from "./main";

const databaseUrl = "postgres://u:p@127.0.0.1:1/pilla";
const accessHashKey = "chave-de-teste-do-hash-com-mais-de-32-caracteres";
const env: ApiEnv = {
  host: "127.0.0.1",
  port: 3000,
  databaseUrl,
  accessHashKey: "chave-de-teste-do-hash-com-mais-de-32-caracteres",
};
let app: INestApplication | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) =>
    server.listen(0, "127.0.0.1", () => {
      resolve();
    }),
  );
  const address = server.address();
  await new Promise<void>((resolve) => {
    server.close(() => {
      resolve();
    });
  });
  if (address === null || typeof address === "string") throw new Error("sem porta");
  return address.port;
}

describe("AppModule", () => {
  it("serve /api/v1/health, recusa fora do prefixo e fecha o banco uma vez", async () => {
    const { db } = await migratedTestDb();
    const close = vi.fn(() => Promise.resolve());
    const moduleRef = await Test.createTestingModule({ imports: [AppModule.forRoot(env)] })
      .overrideProvider(DATABASE_HANDLE)
      .useValue({ db, close })
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.listen(0, "127.0.0.1");

    const ok = await request(await app.getUrl()).get("/api/v1/health");
    const okBody: unknown = ok.body;
    expect(ok.status).toBe(200);
    expect(healthResponseSchema.safeParse(okBody).success).toBe(true);
    expect(okBody).toEqual({ status: "ok", database: "up" });

    const missing = await request(await app.getUrl()).get("/health");
    const missingBody: unknown = missing.body;
    expect(missing.status).toBe(404);
    expect(problemSchema.safeParse(missingBody).success).toBe(true);
    expect(missingBody).toMatchObject({ code: "NOT_FOUND" });

    await app.close();
    app = undefined;
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("sobe e fecha com DATABASE_URL válida, sem Postgres no ar", async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule.forRoot(env)] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.listen(0, "127.0.0.1");
    const res = await request(await app.getUrl()).get("/api/v1/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "degraded", database: "down" });
  });
});

describe("createDatabase", () => {
  it("devolve db e fecha o pool", async () => {
    const handle = createDatabase(databaseUrl);
    expect(typeof handle.db.execute).toBe("function");
    await expect(handle.close()).resolves.toBeUndefined();
  });
});

describe("bootstrap", () => {
  it("escuta em 127.0.0.1 na porta pedida com o prefixo /api/v1", async () => {
    const port = await freePort();
    app = await bootstrap({
      PILLA_API_PORT: String(port),
      DATABASE_URL: databaseUrl,
      PILLA_ACCESS_HASH_KEY: accessHashKey,
    });
    expect(await app.getUrl()).toBe(`http://127.0.0.1:${String(port)}`);
    const res = await fetch(`http://127.0.0.1:${String(port)}/api/v1/health`);
    expect(res.status).toBe(200);
    expect(healthResponseSchema.safeParse(await res.json()).success).toBe(true);
  });

  it("avisa no log quando a autenticação está desligada", async () => {
    const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    app = await bootstrap({
      PILLA_API_PORT: String(await freePort()),
      DATABASE_URL: databaseUrl,
      PILLA_ACCESS_HASH_KEY: accessHashKey,
      PILLA_AUTH_ENFORCED: "false",
    });
    expect(warn).toHaveBeenCalledWith("autenticação DESLIGADA, só desenvolvimento");
    warn.mockRestore();
  });

  it("rejeita ambiente inválido com as mensagens de env", async () => {
    await expect(
      bootstrap({ PILLA_API_PORT: "80", DATABASE_URL: databaseUrl, PILLA_ACCESS_HASH_KEY: accessHashKey }),
    ).rejects.toThrow("PILLA_API_PORT inválida: informe um inteiro de 1024 a 65535.");
    await expect(bootstrap({ PILLA_API_PORT: "3000" })).rejects.toThrow(
      "DATABASE_URL ausente: informe postgres://usuario:senha@host:porta/banco.",
    );
  });
});
