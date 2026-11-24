import type { PGlite } from "@electric-sql/pglite";
import { Controller, Get, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../../app.module";
import { CurrentActor } from "../../core/http/actor";
import { configureApp } from "../../core/http/configure-app";
import type { ApiEnv } from "../../core/http/env";
import type { RequestActor } from "../../core/public/actor";
import { DATABASE_HANDLE } from "../../db/database";
import { migratedTestDb } from "../../db/test-db";

// Modo PILLA_AUTH_ENFORCED=false (só desenvolvimento): sem sessão a API age como um admin ativo do banco.
const base: ApiEnv = {
  host: "127.0.0.1",
  port: 3000,
  databaseUrl: "postgres://u:p@127.0.0.1:1/pilla",
  accessHashKey: "chave-de-teste-do-hash-com-mais-de-32-caracteres",
};
const ADMIN = "01970000-0000-7000-8000-000000000f11";
const PROBE = "/api/v1/probe-disabled";

@Controller("probe-disabled")
class ProbeController {
  @Get()
  whoami(@CurrentActor() actor: RequestActor | undefined): { actor: RequestActor | null } {
    return { actor: actor ?? null };
  }
}

let client: PGlite;
const apps: INestApplication[] = [];

async function start(env: ApiEnv): Promise<string> {
  const migrated = await migratedTestDbRef();
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule.forRoot(env, { outboxPoller: false })],
    controllers: [ProbeController],
  })
    .overrideProvider(DATABASE_HANDLE)
    .useValue({ db: migrated.db, close: () => Promise.resolve() })
    .compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  app.useLogger(false);
  await app.listen(0, "127.0.0.1");
  apps.push(app);
  return app.getUrl();
}

let cached: Awaited<ReturnType<typeof migratedTestDb>> | undefined;
async function migratedTestDbRef(): Promise<Awaited<ReturnType<typeof migratedTestDb>>> {
  cached ??= await migratedTestDb();
  client = cached.client;
  return cached;
}

beforeAll(async () => {
  await migratedTestDbRef();
});
afterAll(async () => {
  for (const app of apps) await app.close();
  await client.close();
});
beforeEach(async () => {
  await client.query("delete from access.sessions");
  await client.query("delete from access.admin_users");
});

async function seedAdmin(): Promise<void> {
  await client.query(
    `insert into access.admin_users (id, username, password_hash, active) values ($1, 'dev', 'x', true)`,
    [ADMIN],
  );
}

describe("PILLA_AUTH_ENFORCED", () => {
  it("ligado (padrão): sem sessão dá 401", async () => {
    const url = await start(base);
    expect((await request(url).get(PROBE)).status).toBe(401);
    expect((await request(url).get("/api/v1/auth/me")).status).toBe(401);
  });

  it("ligado explícito: sem sessão dá 401", async () => {
    const url = await start({ ...base, authEnforced: true });
    expect((await request(url).get(PROBE)).status).toBe(401);
  });

  it("desligado: sem sessão usa o admin ativo como ator e /auth/me o devolve", async () => {
    await seedAdmin();
    const url = await start({ ...base, authEnforced: false });
    const res = await request(url).get(PROBE);
    expect(res.status).toBe(200);
    expect((res.body as { actor: RequestActor }).actor).toMatchObject({ type: "ADMIN", adminUserId: ADMIN });
    const me = await request(url).get("/api/v1/auth/me");
    expect(me.status).toBe(200);
    expect(me.body).toEqual({ id: ADMIN, username: "dev", role: "ADMIN" });
  });

  it("desligado e sem admin ativo: falha com mensagem clara", async () => {
    const url = await start({ ...base, authEnforced: false });
    const res = await request(url).get(PROBE);
    expect(res.status).toBe(401);
    expect(JSON.stringify(res.body)).toContain("db:seed-admin");
  });

  it("desligado: admin inativo não é usado", async () => {
    await seedAdmin();
    await client.query("update access.admin_users set active = false");
    const url = await start({ ...base, authEnforced: false });
    expect((await request(url).get(PROBE)).status).toBe(401);
  });
});
