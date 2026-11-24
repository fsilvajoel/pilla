import type { PGlite } from "@electric-sql/pglite";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { adminMeResponse } from "@pilla/schemas";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AppModule } from "../../app.module";
import { configureApp } from "../../core/http/configure-app";
import type { ApiEnv } from "../../core/http/env";
import { DATABASE_HANDLE } from "../../db/database";
import { migratedTestDb } from "../../db/test-db";
import { hashPassword } from "../domain/password";
import { sessionIdOf } from "../domain/session-token";

// Rotas de entrada do ADMIN (E14 D3 a D6, E14-F02 C1 a C18): login, logout e me com cookie pilla_session.
// O IP do cliente vem em X-Forwarded-For (a conexão do teste é do loopback, como a do Next, E14 D7).
// O limite de tentativas conta por IP e fica em memória: cada teste usa um IP próprio.
// Senhas abaixo são fictícias, só deste teste.
const env: ApiEnv = { host: "127.0.0.1", port: 3000, databaseUrl: "postgres://u:p@127.0.0.1:1/pilla" };
const ADMIN = "01970000-0000-7000-8000-000000000e01";
const INACTIVE = "01970000-0000-7000-8000-000000000e02";
const PASSWORD = "senha ficticia de teste 01";
const INACTIVE_PASSWORD = "senha ficticia de teste 02";
const WRONG_PASSWORD = "senha ficticia errada 03";
const GENERIC_DETAIL = "Usuário ou senha inválidos.";
const T0 = new Date("2026-11-23T12:00:00Z");
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const LOGIN = "/api/v1/auth/admin/login";
const LOGOUT = "/api/v1/auth/admin/logout";
const ME = "/api/v1/auth/me";

type ProblemBody = { code?: string; status?: number; detail?: string };
type Reply = { status: number; body: ProblemBody; text: string; contentType: string; cookies: string[] };
type SessionDbRow = { id: string; role: string; admin_user_id: string; ip: string; created_at: Date; expires_at: Date };

let client: PGlite;
let app: INestApplication;
let baseUrl: string;
let ipSeq = 0;
let adminHash = "";
let inactiveHash = "";

/** IP novo por chamada, da faixa de documentação (RFC 5737). */
const freshIp = (): string => `198.51.100.${String(++ipSeq)}`;
const at = (ms: number): void => {
  vi.setSystemTime(new Date(T0.getTime() + ms));
};

function reply(res: request.Response): Reply {
  const raw: unknown = res.headers["set-cookie"];
  const cookies = Array.isArray(raw) ? raw.filter((c): c is string => typeof c === "string") : [];
  return {
    status: res.status,
    body: res.body as ProblemBody,
    text: res.text,
    contentType: String(res.headers["content-type"]),
    cookies,
  };
}

async function login(username: string, password: string, ip: string): Promise<Reply> {
  return reply(await request(baseUrl).post(LOGIN).set("X-Forwarded-For", ip).send({ username, password }));
}
async function loginBody(body: Record<string, unknown>, ip: string): Promise<Reply> {
  return reply(await request(baseUrl).post(LOGIN).set("X-Forwarded-For", ip).send(body));
}
async function me(token?: string): Promise<Reply> {
  const call = request(baseUrl).get(ME);
  return reply(await (token === undefined ? call : call.set("Cookie", `pilla_session=${token}`)));
}
async function logout(token?: string): Promise<Reply> {
  const call = request(baseUrl).post(LOGOUT);
  return reply(await (token === undefined ? call : call.set("Cookie", `pilla_session=${token}`)));
}

/** Pares nome/valor e atributos do único Set-Cookie pilla_session. */
function sessionCookie(r: Reply): { value: string; attributes: string[] } {
  const ours = r.cookies.filter((c) => c.startsWith("pilla_session="));
  expect(ours).toHaveLength(1);
  const [pair = "", ...attributes] = (ours[0] ?? "").split(";").map((part) => part.trim());
  return { value: pair.slice("pilla_session=".length), attributes: attributes.map((a) => a.toLowerCase()) };
}

async function loggedIn(ip = freshIp()): Promise<string> {
  const r = await login("joana", PASSWORD, ip);
  expect(r.status).toBe(200);
  return sessionCookie(r).value;
}

const sessionRows = async (): Promise<SessionDbRow[]> =>
  (await client.query<SessionDbRow>("select * from access.sessions")).rows;

function expectProblem(r: Reply, status: number, code: string): void {
  expect(r.status).toBe(status);
  expect(r.contentType).toMatch(/^application\/problem\+json/);
  expect(r.body).toMatchObject({ status, code });
}

beforeAll(async () => {
  [adminHash, inactiveHash] = await Promise.all([hashPassword(PASSWORD), hashPassword(INACTIVE_PASSWORD)]);
  const migrated = await migratedTestDb();
  client = migrated.client;
  const moduleRef = await Test.createTestingModule({ imports: [AppModule.forRoot(env)] })
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
  at(0);
  await client.query("delete from access.sessions");
  await client.query("delete from access.admin_users");
  await client.query(
    `insert into access.admin_users (id, username, password_hash, active)
     values ($1, 'joana', $2, true), ($3, 'pedro', $4, false)`,
    [ADMIN, adminHash, INACTIVE, inactiveHash],
  );
});
afterEach(() => {
  vi.useRealTimers();
});

describe("POST /auth/admin/login", () => {
  it("C1: right username and password give 200 with adminMeResponse", async () => {
    const r = await login("joana", PASSWORD, freshIp());
    expect(r.status).toBe(200);
    expect(adminMeResponse.safeParse(r.body).success).toBe(true);
    expect(r.body).toEqual({ id: ADMIN, username: "joana", role: "ADMIN" });
    expect(r.text).not.toContain(PASSWORD);
  });

  it("C2: sets one pilla_session cookie, HttpOnly, Secure, SameSite=Lax, Path=/ and no own lifetime", async () => {
    const { value, attributes } = sessionCookie(await login("joana", PASSWORD, freshIp()));
    expect(value).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(attributes).toEqual(expect.arrayContaining(["httponly", "secure", "samesite=lax", "path=/"]));
    expect(attributes.some((a) => a.startsWith("max-age=") || a.startsWith("expires="))).toBe(false);
  });

  it("C3: the session row id is the SHA-256 of the cookie, never the cookie itself", async () => {
    const ip = freshIp();
    const token = await loggedIn(ip);
    const rows = await sessionRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: sessionIdOf(token),
      role: "ADMIN",
      admin_user_id: ADMIN,
      ip,
      created_at: T0,
      expires_at: new Date("2026-11-24T00:00:00Z"),
    });
    expect(JSON.stringify(rows)).not.toContain(token);
  });

  it("C4: sets admin_users.last_login_at to now", async () => {
    await loggedIn();
    const { rows } = await client.query<{ last_login_at: Date | null }>(
      "select last_login_at from access.admin_users where id = $1",
      [ADMIN],
    );
    expect(rows[0]?.last_login_at).toEqual(T0);
  });

  it.each([
    ["C5: unknown user", "ninguem", PASSWORD],
    ["C6: wrong password", "joana", WRONG_PASSWORD],
    ["C7: inactive user with its right password", "pedro", INACTIVE_PASSWORD],
  ])("%s gives the same 401, no cookie and no session row", async (_, username, password) => {
    const r = await login(username, password, freshIp());
    expectProblem(r, 401, "UNAUTHENTICATED");
    expect(r.body.detail).toBe(GENERIC_DETAIL);
    expect(r.cookies.some((c) => c.startsWith("pilla_session="))).toBe(false);
    expect(r.text).not.toContain(password);
    expect(await sessionRows()).toEqual([]);
  });

  it("C7: a failed login does not touch last_login_at", async () => {
    await login("pedro", INACTIVE_PASSWORD, freshIp());
    const { rows } = await client.query<{ last_login_at: Date | null }>(
      "select last_login_at from access.admin_users where id = $1",
      [INACTIVE],
    );
    expect(rows[0]?.last_login_at).toBeNull();
  });

  it.each([
    ["C8: an extra key", { username: "joana", password: PASSWORD, role: "ADMIN" }],
    ["C9: an empty password", { username: "joana", password: "" }],
    ["C9: a blank username", { username: "   ", password: PASSWORD }],
  ])("%s gives 400 VALIDATION_FAILED without echoing the password", async (_, body) => {
    const r = await loginBody(body, freshIp());
    expectProblem(r, 400, "VALIDATION_FAILED");
    expect(r.text).not.toContain(PASSWORD);
    expect(await sessionRows()).toEqual([]);
  });
});

describe("login rate limit", () => {
  it("C10: the 6th login from one IP inside a minute gives 429, even with the right password", async () => {
    const ip = freshIp();
    for (let attempt = 1; attempt <= 5; attempt++) {
      expect((await login("joana", WRONG_PASSWORD, ip)).status).toBe(401);
    }
    const r = await login("joana", PASSWORD, ip);
    expectProblem(r, 429, "TOO_MANY_REQUESTS");
    expect(r.cookies.some((c) => c.startsWith("pilla_session="))).toBe(false);
    expect(await sessionRows()).toEqual([]);
  });

  it("C10: five logins from one IP inside a minute all pass", async () => {
    const ip = freshIp();
    for (let attempt = 1; attempt <= 4; attempt++) {
      expect((await login("joana", WRONG_PASSWORD, ip)).status).toBe(401);
    }
    expect((await login("joana", PASSWORD, ip)).status).toBe(200);
  });

  it("C11: another IP still logs in while one IP is blocked", async () => {
    const blocked = freshIp();
    for (let attempt = 1; attempt <= 6; attempt++) await login("joana", WRONG_PASSWORD, blocked);
    expect((await login("joana", PASSWORD, blocked)).status).toBe(429);
    expect((await login("joana", PASSWORD, freshIp())).status).toBe(200);
  });
});

describe("GET /auth/me", () => {
  it("C12: a valid cookie gives 200 adminMeResponse", async () => {
    const token = await loggedIn();
    at(5 * MINUTE);
    const r = await me(token);
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ id: ADMIN, username: "joana", role: "ADMIN" });
  });

  it("C12: no cookie gives 401 UNAUTHENTICATED", async () => {
    const r = await me();
    expect(r.status).toBe(401);
    expectProblem(r, 401, "UNAUTHENTICATED");
  });

  it("C12: an unknown token gives 401", async () => {
    await loggedIn();
    expectProblem(await me("A".repeat(43)), 401, "UNAUTHENTICATED");
    expect(await sessionRows()).toHaveLength(1);
  });

  it("C13: a session idle for more than 2 h gives 401 and its row is deleted", async () => {
    const token = await loggedIn();
    at(2 * HOUR + 1000);
    expectProblem(await me(token), 401, "UNAUTHENTICATED");
    expect(await sessionRows()).toEqual([]);
  });

  it("C14: a session past expires_at gives 401 and its row is deleted", async () => {
    const token = await loggedIn();
    await client.query("update access.sessions set expires_at = $1", [new Date(T0.getTime() + 5 * MINUTE)]);
    at(6 * MINUTE);
    expectProblem(await me(token), 401, "UNAUTHENTICATED");
    expect(await sessionRows()).toEqual([]);
  });

  it("C15: a session of an admin made inactive gives 401", async () => {
    const token = await loggedIn();
    await client.query("update access.admin_users set active = false where id = $1", [ADMIN]);
    const r = await me(token);
    expect(r.status).toBe(401);
    expectProblem(r, 401, "UNAUTHENTICATED");
  });

  it("C16: last_seen_at moves forward only when older than 1 minute", async () => {
    const token = await loggedIn();
    const lastSeen = async (): Promise<Date | undefined> =>
      (await client.query<{ last_seen_at: Date }>("select last_seen_at from access.sessions")).rows[0]?.last_seen_at;
    at(30_000);
    expect((await me(token)).status).toBe(200);
    expect(await lastSeen()).toEqual(T0);
    at(2 * MINUTE);
    expect((await me(token)).status).toBe(200);
    expect(await lastSeen()).toEqual(new Date("2026-11-23T12:02:00Z"));
  });
});

describe("POST /auth/admin/logout", () => {
  it("C17: a valid cookie gives 204, deletes the row and expires the cookie", async () => {
    const token = await loggedIn();
    const r = await logout(token);
    expect(r.status).toBe(204);
    expect(await sessionRows()).toEqual([]);
    const { value, attributes } = sessionCookie(r);
    expect(value).toBe("");
    const expires = attributes.find((a) => a.startsWith("expires="));
    const gone =
      attributes.includes("max-age=0") ||
      (expires !== undefined && new Date(expires.slice("expires=".length)).getTime() <= T0.getTime());
    expect(gone).toBe(true);
    expect(attributes).toEqual(expect.arrayContaining(["httponly", "secure", "samesite=lax", "path=/"]));
  });

  it("C17: the old cookie then gives 401 on me", async () => {
    const token = await loggedIn();
    expect((await logout(token)).status).toBe(204);
    expectProblem(await me(token), 401, "UNAUTHENTICATED");
  });

  it("C17: logout leaves the other sessions alive", async () => {
    const first = await loggedIn();
    const second = await loggedIn();
    expect((await logout(first)).status).toBe(204);
    expect((await me(second)).status).toBe(200);
  });

  it("C18: without a cookie it gives 401 UNAUTHENTICATED under the global guard", async () => {
    await loggedIn();
    expectProblem(await logout(), 401, "UNAUTHENTICATED");
    expect(await sessionRows()).toHaveLength(1);
  });
});
