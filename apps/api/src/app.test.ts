import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { AppModule } from "./app.module";
import { bootstrap } from "./main";
import { configureApp } from "./core/http/configure-app";
import { DATABASE_HANDLE } from "./db/database";
import type { DatabaseHandle } from "./db/database";
import { migratedTestDb } from "./db/test-db";
import { healthResponseSchema } from "@pilla/schemas";
import { createServer } from "node:net";
import type { AddressInfo, Server } from "node:net";
import type { App } from "supertest/types";

// `getHttpServer()` é tipado como any; aqui vira o tipo que o supertest aceita.
function httpServer(app: INestApplication): App {
  return app.getHttpServer() as App;
}

describe("App, bootstrap e composição (A10, A11)", () => {
  let dbHandle: DatabaseHandle;

  beforeAll(async () => {
    const migrated = await migratedTestDb();
    dbHandle = migrated;
  });

  afterAll(async () => {
    await dbHandle.close();
  });

  describe("C24 (A10, unit): AppModule com DATABASE_HANDLE trocado", () => {
    let app: INestApplication;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [
          AppModule.forRoot({
            host: "127.0.0.1",
            port: 3000,
            databaseUrl: "postgres://u:p@127.0.0.1:5432/pilla",
          }),
        ],
      })
        .overrideProvider(DATABASE_HANDLE)
        .useValue(dbHandle)
        .compile();

      app = moduleRef.createNestApplication();
      configureApp(app);
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    it("GET /api/v1/health responde 200", async () => {
      await request(httpServer(app))
        .get("/api/v1/health")
        .expect(200)
        .expect((res) => {
          expect(healthResponseSchema.safeParse(res.body).success).toBe(true);
        });
    });

    it("GET /health (sem prefixo) responde 404 NOT_FOUND", async () => {
      await request(httpServer(app))
        .get("/health")
        .expect(404)
        .expect("Content-Type", /application\/problem\+json/)
        .expect({ title: "Não encontrado", status: 404, detail: "Recurso não encontrado.", code: "NOT_FOUND" });
    });

    it("app.close() chama close() do handle uma vez", async () => {
      let closeCount = 0;
      const originalClose = dbHandle.close.bind(dbHandle);
      dbHandle.close = async () => {
        closeCount++;
        await originalClose();
      };

      await app.close();
      expect(closeCount).toBe(1);
    });
  });

  describe("C25 (A10, unit): AppModule sem troca sobe e fecha sem abrir conexão", () => {
    it("createDatabase devolve db e close() resolve", async () => {
      const { createDatabase } = await import("./db/database");
      const handle = createDatabase("postgres://u:p@127.0.0.1:5432/pilla");
      expect(typeof handle.db.select).toBe("function");
      await expect(handle.close()).resolves.toBeUndefined();
    });
  });

  describe("C26 (A11, unit): bootstrap escuta em 127.0.0.1:porta", () => {
    let app: INestApplication;
    let freePort = 0;

    // Pede uma porta livre ao SO (porta 0), lê o número e fecha o servidor.
    async function pickFreePort(): Promise<number> {
      const probe = createServer();
      await new Promise<void>((resolve) => probe.listen(0, "127.0.0.1", resolve));
      const { port } = probe.address() as AddressInfo;
      await new Promise<void>((resolve) =>
        probe.close(() => {
          resolve();
        }),
      );
      return port;
    }

    beforeAll(async () => {
      freePort = await pickFreePort();
      app = await bootstrap({
        PILLA_API_PORT: String(freePort),
        DATABASE_URL: "postgres://u:p@127.0.0.1:5432/pilla",
      });
    });

    afterAll(async () => {
      await app.close();
    });

    it("devolve app escutando e health responde", async () => {
      const address = (app.getHttpServer() as Server).address() as AddressInfo;
      expect(address).toMatchObject({ address: "127.0.0.1" });
      expect(address.address).toBe("127.0.0.1");
      expect(address.port).toBe(freePort);

      await request(`http://127.0.0.1:${String(freePort)}`)
        .get("/api/v1/health")
        .expect(200);
    });
  });

  describe("C27 (A11, unit): bootstrap rejeita env inválido antes de criar app", () => {
    it("PILLA_API_PORT inválida rejeita com mensagem de A1", async () => {
      await expect(
        bootstrap({
          PILLA_API_PORT: "80",
          DATABASE_URL: "postgres://u:p@127.0.0.1:5432/pilla",
        }),
      ).rejects.toThrow("PILLA_API_PORT inválida: informe um inteiro de 1024 a 65535.");
    });

    it("DATABASE_URL ausente rejeita com mensagem de A2", async () => {
      await expect(
        bootstrap({
          PILLA_API_PORT: "3000",
        }),
      ).rejects.toThrow("DATABASE_URL ausente: informe postgres://usuario:senha@host:porta/banco.");
    });
  });
});
