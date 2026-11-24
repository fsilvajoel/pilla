import type { PGlite } from "@electric-sql/pglite";
import type { INestApplication } from "@nestjs/common";
import { drizzle } from "drizzle-orm/pglite";
import { Test } from "@nestjs/testing";
import { createHash, createHmac } from "node:crypto";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AppModule } from "../../app.module";
import { configureApp } from "../../core/http/configure-app";
import type { ApiEnv } from "../../core/http/env";
import { DATABASE_HANDLE } from "../../db/database";
import { migratedTestDb } from "../../db/test-db";

// Entrada do portal por CPF (RN-A04, CA-09b, E15 D3 a D6, E15-F02 C7 a C14). O IP vem em X-Forwarded-For.
const KEY = "chave-de-teste-do-hash-com-mais-de-32-caracteres";
const OTHER_KEY = "outra-chave-de-teste-do-hash-com-32-caracteres";
const env: ApiEnv = {
  host: "127.0.0.1",
  port: 3000,
  databaseUrl: "postgres://u:p@127.0.0.1:1/pilla",
  accessHashKey: KEY,
};
const ADMIN = "01970000-0000-7000-8000-000000000f01";
const ENABLED = "01970000-0000-7000-8000-000000000f11";
const DISABLED = "01970000-0000-7000-8000-000000000f12";
const NO_ROW = "01970000-0000-7000-8000-000000000f13";
const ENABLED_CPF = "52998224725";
const DISABLED_CPF = "11144477735";
const NO_ROW_CPF = "39053344705";
const UNKNOWN_CPF = "12345678909";
const T0 = new Date("2026-11-23T12:00:00Z");
const HOUR = 3_600_000;
const GENERIC = "Não foi possível entrar com este CPF.";
const SESSION = "/api/v1/portal/session";

type Reply = {
  status: number;
  body: Record<string, unknown>;
  text: string;
  headers: Record<string, unknown>;
  cookies: string[];
};

let client: PGlite;
let app: INestApplication;
let baseUrl: string;
let ipSeq = 0;
const queries: string[] = [];
const freshIp = (): string => `198.51.100.${String(++ipSeq)}`;

function reply(res: request.Response): Reply {
  const raw: unknown = res.headers["set-cookie"];
  const cookies = Array.isArray(raw) ? raw.filter((c): c is string => typeof c === "string") : [];
  return {
    status: res.status,
    body: res.body as Record<string, unknown>,
    text: res.text,
    headers: res.headers,
    cookies,
  };
}
const enter = async (body: unknown, ip: string): Promise<Reply> =>
  reply(
    await request(baseUrl)
      .post(SESSION)
      .set("X-Forwarded-For", ip)
      .send(body as object),
  );
const leave = async (cookie?: string): Promise<Reply> => {
  const call = request(baseUrl).delete(SESSION);
  return reply(await (cookie === undefined ? call : call.set("Cookie", cookie)));
};
const hmac = (cpf: string, key = KEY): string => createHmac("sha256", key).update(cpf).digest("hex");

function portalCookie(r: Reply): { value: string; attributes: string[] } {
  const ours = r.cookies.filter((c) => c.startsWith("pilla_portal="));
  expect(ours).toHaveLength(1);
  const [pair = "", ...attributes] = (ours[0] ?? "").split(";").map((part) => part.trim());
  return { value: pair.slice("pilla_portal=".length), attributes: attributes.map((a) => a.toLowerCase()) };
}
const rows = async <T>(sql: string, params: unknown[] = []): Promise<T[]> => (await client.query<T>(sql, params)).rows;
const logs = (): Promise<{ ip: string; cpf_hash: string; result: string }[]> =>
  rows("select ip, cpf_hash, result from access.access_logs order by at, id");

beforeAll(async () => {
  const migrated = await migratedTestDb();
  client = migrated.client;
  const moduleRef = await Test.createTestingModule({ imports: [AppModule.forRoot(env, { outboxPoller: false })] })
    .overrideProvider(DATABASE_HANDLE)
    .useValue({
      db: drizzle({ client, logger: { logQuery: (query: string) => queries.push(query.replace(/\s+/g, " ")) } }),
      close: () => Promise.resolve(),
    })
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
  for (const table of ["access.access_logs", "access.sessions", "access.portal_access"]) {
    await client.query(`delete from ${table}`);
  }
  await client.query("delete from access.admin_users");
  await client.query("delete from people.persons");
  await client.query("insert into access.admin_users (id, username, password_hash) values ($1, 'joana', 'x')", [ADMIN]);
  for (const [id, name, cpf] of [
    [ENABLED, "Ana Cliente", ENABLED_CPF],
    [DISABLED, "Bia Cliente", DISABLED_CPF],
    [NO_ROW, "Caio Cliente", NO_ROW_CPF],
  ]) {
    await client.query("insert into people.persons (id, full_name, cpf, phone) values ($1, $2, $3, '+5511999990000')", [
      id,
      name,
      cpf,
    ]);
  }
  await client.query(
    `insert into access.portal_access (person_id, enabled, enabled_at, enabled_by) values
     ($1, true, $3, $4), ($2, false, $3, $4)`,
    [ENABLED, DISABLED, T0, ADMIN],
  );
});
afterEach(() => {
  vi.useRealTimers();
});

describe("POST /portal/session: a person with access", () => {
  it("C7: gives 204 with no body and one pilla_portal cookie with the right attributes", async () => {
    const r = await enter({ cpf: ENABLED_CPF }, freshIp());
    expect(r.status).toBe(204);
    expect(r.text).toBe("");
    const { value, attributes } = portalCookie(r);
    expect(value).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(attributes).toEqual(expect.arrayContaining(["httponly", "secure", "samesite=lax", "path=/api/v1/portal"]));
    expect(attributes.some((a) => a.startsWith("domain="))).toBe(false);
  });

  it("C7: the session row id is the SHA-256 of the token, which is not in the database", async () => {
    const ip = freshIp();
    const { value } = portalCookie(await enter({ cpf: ENABLED_CPF }, ip));
    const sessions = await rows<{ id: string; role: string; person_id: string; ip: string; expires_at: Date }>(
      "select id, role, person_id, ip, expires_at from access.sessions",
    );
    expect(sessions).toEqual([
      {
        id: createHash("sha256").update(value).digest("hex"),
        role: "CLIENT",
        person_id: ENABLED,
        ip,
        expires_at: new Date(T0.getTime() + 2 * HOUR),
      },
    ]);
    expect(JSON.stringify(await rows("select * from access.sessions"))).not.toContain(value);
    expect(JSON.stringify(await logs())).not.toContain(value);
  });

  it("C7: writes one OK row in access_logs", async () => {
    const ip = freshIp();
    await enter({ cpf: ENABLED_CPF }, ip);
    expect(await logs()).toEqual([{ ip, cpf_hash: hmac(ENABLED_CPF), result: "OK" }]);
  });

  it("C7: answers with Cache-Control no-store and no other Set-Cookie", async () => {
    const r = await enter({ cpf: ENABLED_CPF }, freshIp());
    expect(r.headers["cache-control"]).toContain("no-store");
    expect(r.cookies).toHaveLength(1);
  });

  it("C8: two entries make two different tokens and two sessions", async () => {
    const first = portalCookie(await enter({ cpf: ENABLED_CPF }, freshIp()));
    const second = portalCookie(await enter({ cpf: ENABLED_CPF }, freshIp()));
    expect(first.value).not.toBe(second.value);
    expect(await rows("select id from access.sessions")).toHaveLength(2);
  });

  it("C9: a new entry deletes the expired sessions of that person and keeps the valid ones", async () => {
    const valid = portalCookie(await enter({ cpf: ENABLED_CPF }, freshIp()));
    const insert = `insert into access.sessions (id, role, person_id, created_at, expires_at, last_seen_at, ip)
                    values ($1, 'CLIENT', $2, $3, $4, $5, '203.0.113.1')`;
    const old = new Date(T0.getTime() - 5 * HOUR);
    await client.query(insert, ["e".repeat(64), ENABLED, old, new Date(T0.getTime() - HOUR), old]);
    await client.query(insert, ["f".repeat(64), DISABLED, old, new Date(T0.getTime() - HOUR), old]);
    await enter({ cpf: ENABLED_CPF }, freshIp());
    const ids = (await rows<{ id: string }>("select id from access.sessions")).map((row) => row.id);
    expect(ids).toContain(createHash("sha256").update(valid.value).digest("hex"));
    expect(ids).not.toContain("e".repeat(64));
    expect(ids).toContain("f".repeat(64));
    expect(ids).toHaveLength(3);
  });
});

describe("POST /portal/session: the generic answer", () => {
  const cases: [string, string, string][] = [
    ["an unknown CPF", UNKNOWN_CPF, "NOT_FOUND"],
    ["a person with no portal_access row", NO_ROW_CPF, "NOT_FOUND"],
    ["a disabled person", DISABLED_CPF, "DISABLED"],
  ];

  it.each(cases)(
    "C10: %s gives 401 UNAUTHENTICATED with the fixed detail and no cookie",
    async (_name, cpf, result) => {
      const ip = freshIp();
      const r = await enter({ cpf }, ip);
      expect(r.status).toBe(401);
      expect(r.body).toMatchObject({ status: 401, code: "UNAUTHENTICATED", detail: GENERIC });
      expect(r.cookies).toEqual([]);
      expect(await rows("select id from access.sessions")).toEqual([]);
      expect((await logs()).map((row) => row.result)).toEqual([result]);
    },
  );

  it("C10: the three cases return the same status, body and headers", async () => {
    const replies = [];
    for (const [, cpf] of cases) replies.push(await enter({ cpf }, freshIp()));
    const [first, ...rest] = replies;
    const shape = (r: Reply): unknown => ({
      status: r.status,
      text: r.text,
      type: r.headers["content-type"],
      length: r.headers["content-length"],
      cache: r.headers["cache-control"],
      keys: Object.keys(r.headers).sort(),
    });
    for (const other of rest) expect(shape(other)).toEqual(shape(first as Reply));
  });

  it("C10: the three cases run the same queries in the same order", async () => {
    const trace: string[][] = [];
    for (const [, cpf] of cases) {
      queries.length = 0;
      await enter({ cpf }, freshIp());
      trace.push([...queries]);
    }
    expect(trace[0]?.length).toBeGreaterThan(2);
    expect(trace[1]).toEqual(trace[0]);
    expect(trace[2]).toEqual(trace[0]);
  });
});

describe("POST /portal/session: the CPF hash", () => {
  it("C11: cpf_hash is the HMAC-SHA256 of the CPF with the configured key", async () => {
    await enter({ cpf: UNKNOWN_CPF }, freshIp());
    const [row] = await logs();
    expect(row?.cpf_hash).toBe(hmac(UNKNOWN_CPF));
    expect(row?.cpf_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row?.cpf_hash).not.toBe(hmac(UNKNOWN_CPF, OTHER_KEY));
  });

  it("C11: the CPF in plain text is in no table and in no response", async () => {
    const replies = [
      await enter({ cpf: ENABLED_CPF }, freshIp()),
      await enter({ cpf: DISABLED_CPF }, freshIp()),
      await enter({ cpf: UNKNOWN_CPF }, freshIp()),
      await enter({ cpf: "123" }, freshIp()),
    ];
    for (const r of replies) {
      expect(JSON.stringify([r.text, r.headers, r.cookies])).not.toMatch(/52998224725|11144477735|12345678909/);
    }
    const dump = JSON.stringify([
      await rows("select * from access.access_logs"),
      await rows("select * from access.sessions"),
      await rows("select * from core.audit_log"),
    ]);
    expect(dump).not.toMatch(/52998224725|11144477735|12345678909/);
  });
});

describe("POST /portal/session: malformed input and the rate limit", () => {
  it.each([
    ["punctuation", { cpf: "529.982.247-25" }],
    ["a wrong check digit", { cpf: "52998224726" }],
    ["a number", { cpf: 52998224725 }],
    ["an extra key", { cpf: ENABLED_CPF, role: "ADMIN" }],
    ["no cpf", {}],
  ])("C12: %s gives 400 VALIDATION_FAILED, a NOT_FOUND log and no session", async (_name, body) => {
    const ip = freshIp();
    const r = await enter(body, ip);
    expect(r.status).toBe(400);
    expect(r.body).toMatchObject({ status: 400, code: "VALIDATION_FAILED" });
    expect(r.cookies).toEqual([]);
    expect((await logs()).map((row) => row.result)).toEqual(["NOT_FOUND"]);
    expect(await rows("select id from access.sessions")).toEqual([]);
  });

  it("C12: a malformed CPF counts in the window", async () => {
    const ip = freshIp();
    for (let i = 0; i < 30; i++) expect((await enter({ cpf: "abc" }, ip)).status).toBe(400);
    const r = await enter({ cpf: ENABLED_CPF }, ip);
    expect(r.status).toBe(429);
  });

  it("C1: 30 attempts from one IP pass and the 31st gets 429 with Retry-After and a RATE_LIMITED row", async () => {
    const ip = freshIp();
    for (let i = 0; i < 30; i++) expect((await enter({ cpf: UNKNOWN_CPF }, ip)).status).toBe(401);
    const r = await enter({ cpf: ENABLED_CPF }, ip);
    expect(r.status).toBe(429);
    expect(r.body).toMatchObject({ status: 429, code: "TOO_MANY_REQUESTS" });
    expect(r.headers["retry-after"]).toBe("60");
    expect(r.cookies).toEqual([]);
    const all = await logs();
    expect(all).toHaveLength(31);
    expect(all.filter((row) => row.result === "RATE_LIMITED")).toEqual([
      { ip, result: "RATE_LIMITED", cpf_hash: hmac(ENABLED_CPF) },
    ]);
    expect(await rows("select id from access.sessions")).toEqual([]);
  });

  it("C2: another IP is not affected and the blocked IP enters again when the window empties", async () => {
    const ip = freshIp();
    for (let i = 0; i < 30; i++) await enter({ cpf: UNKNOWN_CPF }, ip);
    expect((await enter({ cpf: ENABLED_CPF }, ip)).status).toBe(429);
    expect((await enter({ cpf: ENABLED_CPF }, freshIp())).status).toBe(204);
    vi.setSystemTime(new Date(T0.getTime() + 61_000));
    expect((await enter({ cpf: ENABLED_CPF }, ip)).status).toBe(204);
  });

  it("C3: a blocked attempt does not look the person up (no session even for a valid CPF)", async () => {
    const ip = freshIp();
    for (let i = 0; i < 30; i++) await enter({ cpf: UNKNOWN_CPF }, ip);
    await enter({ cpf: ENABLED_CPF }, ip);
    expect(await rows("select id from access.sessions")).toEqual([]);
  });
});

describe("DELETE /portal/session", () => {
  it("C14: deletes the session row, sends an expired cookie and gives 204", async () => {
    const { value } = portalCookie(await enter({ cpf: ENABLED_CPF }, freshIp()));
    const other = portalCookie(await enter({ cpf: ENABLED_CPF }, freshIp()));
    const r = await leave(`pilla_portal=${value}`);
    expect(r.status).toBe(204);
    expect((await rows<{ id: string }>("select id from access.sessions")).map((row) => row.id)).toEqual([
      createHash("sha256").update(other.value).digest("hex"),
    ]);
    const { value: cleared, attributes } = portalCookie(r);
    expect(cleared).toBe("");
    expect(attributes).toEqual(
      expect.arrayContaining(["httponly", "secure", "samesite=lax", "path=/api/v1/portal", "max-age=0"]),
    );
    expect(r.headers["cache-control"]).toContain("no-store");
  });

  it("C14: without a cookie it also gives 204", async () => {
    const r = await leave();
    expect(r.status).toBe(204);
    expect(portalCookie(r).value).toBe("");
  });

  it("C14: an unknown token also gives 204", async () => {
    expect((await leave(`pilla_portal=${"A".repeat(43)}`)).status).toBe(204);
  });

  it("C14: a junk cookie also gives 204 and deletes nothing", async () => {
    await enter({ cpf: ENABLED_CPF }, freshIp());
    expect((await leave("pilla_portal=lixo")).status).toBe(204);
    expect(await rows("select id from access.sessions")).toHaveLength(1);
  });
});
