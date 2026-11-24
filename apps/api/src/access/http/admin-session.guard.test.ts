import type { PGlite } from "@electric-sql/pglite";
import { Controller, Get, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AppModule } from "../../app.module";
import { CurrentActor } from "../../core/http/actor";
import { configureApp } from "../../core/http/configure-app";
import type { ApiEnv } from "../../core/http/env";
import type { RequestActor } from "../../core/public/actor";
import { DATABASE_HANDLE } from "../../db/database";
import { migratedTestDb } from "../../db/test-db";
import { hashPassword } from "../domain/password";
import { newSessionToken, sessionIdOf } from "../domain/session-token";

// Guard global ADMIN (E14 D7, RN-A01, ADR-0011; E14-F03 C1 a C8): o AppModule inteiro, com um controller de sonda
// sem @Public que devolve o ator recebido. Senha fictícia, só deste teste.
const env: ApiEnv = {
  host: "127.0.0.1",
  port: 3000,
  databaseUrl: "postgres://u:p@127.0.0.1:1/pilla",
  accessHashKey: "chave-de-teste-do-hash-com-mais-de-32-caracteres",
};
const ADMIN = "01970000-0000-7000-8000-000000000f01";
const PERSON = "01970000-0000-7000-8000-000000000f02";
const PASSWORD = "senha ficticia de teste 21";
const T0 = new Date("2026-11-23T12:00:00Z");
const HOUR = 3_600_000;
const PROBE = "/api/v1/probe-guard";

type ProblemBody = { code?: string; status?: number };

@Controller("probe-guard")
class ProbeController {
  @Get()
  whoami(@CurrentActor() actor: RequestActor | undefined): { actor: RequestActor | null } {
    return { actor: actor ?? null };
  }
}

let client: PGlite;
let app: INestApplication;
let baseUrl: string;
let ipSeq = 0;
let adminHash = "";

/** IP novo por login (RFC 5737): o limite de tentativas conta por IP. */
const freshIp = (): string => `198.51.100.${String(++ipSeq)}`;

async function login(ip = freshIp()): Promise<string> {
  const res = await request(baseUrl)
    .post("/api/v1/auth/admin/login")
    .set("X-Forwarded-For", ip)
    .send({ username: "joana", password: PASSWORD });
  expect(res.status).toBe(200);
  const raw: unknown = res.headers["set-cookie"];
  const cookies = Array.isArray(raw) ? raw.filter((c): c is string => typeof c === "string") : [];
  const pair = cookies.find((c) => c.startsWith("pilla_session=")) ?? "";
  return pair.split(";")[0]?.slice("pilla_session=".length) ?? "";
}

function probe(token?: string): request.Test {
  const call = request(baseUrl).get(PROBE);
  return token === undefined ? call : call.set("Cookie", `pilla_session=${token}`);
}

type Problem = { status: number; code: string | undefined; problemJson: boolean };

/** Status, code e se o corpo veio como problem+json (RFC-004 §6). */
function problem(res: request.Response): Problem {
  return {
    status: res.status,
    code: (res.body as ProblemBody).code,
    problemJson: /^application\/problem\+json/.test(String(res.headers["content-type"])),
  };
}

beforeAll(async () => {
  adminHash = await hashPassword(PASSWORD);
  const migrated = await migratedTestDb();
  client = migrated.client;
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule.forRoot(env, { outboxPoller: false })],
    controllers: [ProbeController],
  })
    .overrideProvider(DATABASE_HANDLE)
    .useValue({ db: migrated.db, close: () => Promise.resolve() })
    .compile();
  app = moduleRef.createNestApplication();
  configureApp(app);
  app.useLogger(false);
  await app.listen(0, "127.0.0.1");
  baseUrl = await app.getUrl();
});
afterAll(async () => {
  await app.close();
  await client.close();
});
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
  await client.query("delete from access.sessions");
  await client.query("delete from access.admin_users");
  await client.query(
    `insert into access.admin_users (id, username, password_hash, active) values ($1, 'joana', $2, true)`,
    [ADMIN, adminHash],
  );
});
afterEach(() => {
  vi.useRealTimers();
});

describe("AdminSessionGuard on a route without @Public", () => {
  it("C1: no cookie gives 401 UNAUTHENTICATED", async () => {
    expect(problem(await probe())).toEqual({ status: 401, code: "UNAUTHENTICATED", problemJson: true });
  });

  it("C1: a cookie header without pilla_session gives 401", async () => {
    expect(problem(await request(baseUrl).get(PROBE).set("Cookie", "outro=1"))).toEqual({
      status: 401,
      code: "UNAUTHENTICATED",
      problemJson: true,
    });
  });

  it("C2: an unknown token gives 401 UNAUTHENTICATED", async () => {
    await login();
    expect(problem(await probe("A".repeat(43)))).toEqual({ status: 401, code: "UNAUTHENTICATED", problemJson: true });
  });

  it("C3: a session idle for more than 2 h gives 401 UNAUTHENTICATED", async () => {
    const token = await login();
    vi.setSystemTime(new Date(T0.getTime() + 2 * HOUR + 1000));
    expect(problem(await probe(token))).toEqual({ status: 401, code: "UNAUTHENTICATED", problemJson: true });
  });

  it("C3: a session past expires_at gives 401 UNAUTHENTICATED", async () => {
    const token = await login();
    await client.query("update access.sessions set expires_at = $1", [new Date(T0.getTime() - 1000)]);
    expect(problem(await probe(token))).toEqual({ status: 401, code: "UNAUTHENTICATED", problemJson: true });
  });

  it("C4: a live CLIENT session gives 403 FORBIDDEN", async () => {
    const token = newSessionToken();
    await client.query(
      `insert into access.sessions (id, role, person_id, ip, created_at, last_seen_at, expires_at)
       values ($1, 'CLIENT', $2, '203.0.113.5', $3, $3, $4)`,
      [sessionIdOf(token), PERSON, T0, new Date(T0.getTime() + 12 * HOUR)],
    );
    expect(problem(await probe(token))).toEqual({ status: 403, code: "FORBIDDEN", problemJson: true });
  });

  it("C5: a valid ADMIN session passes with 200", async () => {
    const token = await login();
    expect((await probe(token)).status).toBe(200);
  });

  it("C6: @CurrentActor() receives {type ADMIN, adminUserId, ip}", async () => {
    const token = await login();
    const res = await probe(token).set("X-Forwarded-For", "203.0.113.44");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ actor: { type: "ADMIN", adminUserId: ADMIN, ip: "203.0.113.44" } });
  });
});

describe("public routes", () => {
  it("C7: GET /api/v1/health answers without a cookie", async () => {
    const res = await request(baseUrl).get("/api/v1/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", database: "up" });
  });

  it("C7: the OpenAPI route answers without a cookie", async () => {
    const res = await request(baseUrl).get("/api/v1/openapi.json");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ openapi: "3.1.0" });
  });

  it("C7: POST /api/v1/auth/admin/login answers without a cookie", async () => {
    const token = await login();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("C8: POST /api/v1/auth/admin/logout without a cookie gives 401", async () => {
    expect(problem(await request(baseUrl).post("/api/v1/auth/admin/logout"))).toEqual({
      status: 401,
      code: "UNAUTHENTICATED",
      problemJson: true,
    });
  });

  it("C8: GET /api/v1/auth/me without a cookie gives 401", async () => {
    expect(problem(await request(baseUrl).get("/api/v1/auth/me"))).toEqual({
      status: 401,
      code: "UNAUTHENTICATED",
      problemJson: true,
    });
  });

  it("C8: GET /api/v1/auth/me with a CLIENT session gives 403", async () => {
    const token = newSessionToken();
    await client.query(
      `insert into access.sessions (id, role, person_id, ip, created_at, last_seen_at, expires_at)
       values ($1, 'CLIENT', $2, '203.0.113.6', $3, $3, $4)`,
      [sessionIdOf(token), PERSON, T0, new Date(T0.getTime() + 12 * HOUR)],
    );
    expect(problem(await request(baseUrl).get("/api/v1/auth/me").set("Cookie", `pilla_session=${token}`))).toEqual({
      status: 403,
      code: "FORBIDDEN",
      problemJson: true,
    });
  });
});
