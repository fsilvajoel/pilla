import type { PGlite } from "@electric-sql/pglite";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { portalAccessResponse } from "@pilla/schemas";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AppModule } from "../../app.module";
import { configureApp } from "../../core/http/configure-app";
import type { ApiEnv } from "../../core/http/env";
import { loginAsAdmin, type AdminAgent } from "../../core/http/test-admin-agent";
import { DATABASE_HANDLE } from "../../db/database";
import { migratedTestDb } from "../../db/test-db";
import { sessionIdOf } from "../domain/session-token";

// Habilitar e desabilitar o acesso ao portal (RF-60, RN-A03, E15 D13, E15-F03 C1 a C10), pelo app inteiro com o
// guard ADMIN da E14. O IP do administrador vem em X-Forwarded-For (a conexão do teste é do loopback).
const env: ApiEnv = {
  host: "127.0.0.1",
  port: 3000,
  databaseUrl: "postgres://u:p@127.0.0.1:1/pilla",
  accessHashKey: "chave-de-teste-do-hash-com-mais-de-32-caracteres",
};
const ADMIN = "01970000-0000-7000-8000-00000000ad02";
const WITH_CPF = "01970000-0000-7000-8000-000000000a01";
const OTHER_WITH_CPF = "01970000-0000-7000-8000-000000000a02";
const NO_CPF = "01970000-0000-7000-8000-000000000a03";
const UNKNOWN = "01970000-0000-7000-8000-000000000a99";
const CPF = "52998224725";
const T0 = new Date("2026-11-23T12:00:00Z");
const ADMIN_IP = "198.51.100.77";
const URL = "/api/v1/portal-access";

let client: PGlite;
let app: INestApplication;
let baseUrl: string;
let admin: AdminAgent;

type AccessRow = { enabled: boolean; enabled_at: Date | null; enabled_by: string | null; version: number };
type AuditDbRow = {
  actor_type: string;
  actor_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  before: unknown;
  after: unknown;
  ip: string;
};

const put = (personId: string, body: unknown, agent: AdminAgent = admin): request.Test =>
  agent
    .put(`${URL}/${personId}`)
    .set("X-Forwarded-For", ADMIN_IP)
    .send(body as object);
const get = (personId: string, agent: AdminAgent = admin): request.Test => agent.get(`${URL}/${personId}`);
const accessRows = async (personId: string): Promise<AccessRow[]> =>
  (
    await client.query<AccessRow>(
      "select enabled, enabled_at, enabled_by, version from access.portal_access where person_id = $1",
      [personId],
    )
  ).rows;
const auditRows = async (): Promise<AuditDbRow[]> =>
  (
    await client.query<AuditDbRow>(
      `select actor_type, actor_id, action, entity_type, entity_id, before, after, ip from core.audit_log
       where entity_type = 'portal_access' order by at, id`,
    )
  ).rows;
const seedSession = (token: string, personId: string): Promise<unknown> =>
  client.query(
    `insert into access.sessions (id, role, person_id, created_at, expires_at, last_seen_at, ip)
     values ($1, 'CLIENT', $2, now(), now() + interval '2 hours', now(), '203.0.113.5')`,
    [sessionIdOf(token), personId],
  );
const sessionPersons = async (): Promise<string[]> =>
  (await client.query<{ person_id: string }>("select person_id from access.sessions where role = 'CLIENT'")).rows.map(
    (row) => row.person_id,
  );

beforeAll(async () => {
  const migrated = await migratedTestDb();
  client = migrated.client;
  const moduleRef = await Test.createTestingModule({ imports: [AppModule.forRoot(env, { outboxPoller: false })] })
    .overrideProvider(DATABASE_HANDLE)
    .useValue({ db: migrated.db, close: () => Promise.resolve() })
    .compile();
  app = moduleRef.createNestApplication();
  configureApp(app);
  app.useLogger(false);
  await app.listen(0, "127.0.0.1");
  baseUrl = await app.getUrl();
  admin = await loginAsAdmin(baseUrl, client);
});
afterAll(async () => {
  await app.close();
  await client.close();
});
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
  await client.query("delete from access.portal_access");
  await client.query("delete from core.audit_log");
  await client.query("delete from people.persons");
  await client.query("delete from access.sessions where role = 'CLIENT'");
  for (const [id, name, cpf] of [
    [WITH_CPF, "Ana Cliente", CPF],
    [OTHER_WITH_CPF, "Bia Cliente", "11144477735"],
    [NO_CPF, "Caio Importado", null],
  ]) {
    await client.query("insert into people.persons (id, full_name, cpf, phone) values ($1, $2, $3, '+5511999990000')", [
      id,
      name,
      cpf,
    ]);
  }
});
afterEach(() => {
  vi.useRealTimers();
});

describe("PUT /portal-access/{personId}: enable", () => {
  it("C1: a person with a CPF gets a row, an audit entry and the response schema", async () => {
    const r = await put(WITH_CPF, { enabled: true });
    expect(r.status).toBe(200);
    expect(portalAccessResponse.safeParse(r.body).success).toBe(true);
    expect(r.body).toEqual({ personId: WITH_CPF, enabled: true, enabledAt: "2026-11-23T12:00:00.000Z" });
    expect(await accessRows(WITH_CPF)).toEqual([{ enabled: true, enabled_at: T0, enabled_by: ADMIN, version: 1 }]);
    expect(await auditRows()).toEqual([
      {
        actor_type: "ADMIN",
        actor_id: ADMIN,
        action: "PORTAL_ACCESS_ENABLED",
        entity_type: "portal_access",
        entity_id: WITH_CPF,
        before: null,
        after: { enabled: true },
        ip: ADMIN_IP,
      },
    ]);
  });

  it("C1: enabling again after a disable updates the same row, moves enabled_at and counts the version", async () => {
    await put(WITH_CPF, { enabled: true });
    await put(WITH_CPF, { enabled: false });
    vi.setSystemTime(new Date(T0.getTime() + 3_600_000));
    const r = await put(WITH_CPF, { enabled: true });
    expect(r.status).toBe(200);
    expect(await accessRows(WITH_CPF)).toEqual([
      { enabled: true, enabled_at: new Date(T0.getTime() + 3_600_000), enabled_by: ADMIN, version: 3 },
    ]);
    const actions = (await auditRows()).map((row) => row.action);
    expect(actions).toEqual(["PORTAL_ACCESS_ENABLED", "PORTAL_ACCESS_DISABLED", "PORTAL_ACCESS_ENABLED"]);
    expect((await auditRows())[2]?.before).toEqual({ enabled: false });
  });

  it("C1: no response and no audit entry carries the CPF", async () => {
    const r = await put(WITH_CPF, { enabled: true });
    expect(JSON.stringify([r.text, r.headers, await auditRows()])).not.toContain(CPF);
  });
});

describe("PUT /portal-access/{personId}: disable", () => {
  it("C2: keeps enabled_at and enabled_by, adds 1 to the version and audits the change", async () => {
    await put(WITH_CPF, { enabled: true });
    vi.setSystemTime(new Date(T0.getTime() + 60_000));
    const r = await put(WITH_CPF, { enabled: false });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ personId: WITH_CPF, enabled: false, enabledAt: "2026-11-23T12:00:00.000Z" });
    expect(await accessRows(WITH_CPF)).toEqual([{ enabled: false, enabled_at: T0, enabled_by: ADMIN, version: 2 }]);
    const [, disabled] = await auditRows();
    expect(disabled).toMatchObject({
      actor_type: "ADMIN",
      actor_id: ADMIN,
      action: "PORTAL_ACCESS_DISABLED",
      entity_id: WITH_CPF,
      before: { enabled: true },
      after: { enabled: false },
      ip: ADMIN_IP,
    });
  });

  it("C2: deletes the CLIENT sessions of that person and keeps the ones of another person", async () => {
    await put(WITH_CPF, { enabled: true });
    await put(OTHER_WITH_CPF, { enabled: true });
    await seedSession("a".repeat(43), WITH_CPF);
    await seedSession("b".repeat(43), WITH_CPF);
    await seedSession("c".repeat(43), OTHER_WITH_CPF);
    await put(WITH_CPF, { enabled: false });
    expect(await sessionPersons()).toEqual([OTHER_WITH_CPF]);
  });

  it("C2: enabling does not delete sessions", async () => {
    await seedSession("a".repeat(43), WITH_CPF);
    await put(WITH_CPF, { enabled: true });
    expect(await sessionPersons()).toEqual([WITH_CPF]);
  });
});

describe("PUT /portal-access/{personId}: idempotence", () => {
  it("C3: repeating enable answers 200 and writes no audit entry nor a new version", async () => {
    await put(WITH_CPF, { enabled: true });
    vi.setSystemTime(new Date(T0.getTime() + 60_000));
    const r = await put(WITH_CPF, { enabled: true });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ personId: WITH_CPF, enabled: true, enabledAt: "2026-11-23T12:00:00.000Z" });
    expect(await accessRows(WITH_CPF)).toEqual([{ enabled: true, enabled_at: T0, enabled_by: ADMIN, version: 1 }]);
    expect(await auditRows()).toHaveLength(1);
  });

  it("C3: repeating disable answers 200 and writes nothing more", async () => {
    await put(WITH_CPF, { enabled: true });
    await put(WITH_CPF, { enabled: false });
    await seedSession("a".repeat(43), WITH_CPF);
    const r = await put(WITH_CPF, { enabled: false });
    expect(r.status).toBe(200);
    expect(await accessRows(WITH_CPF)).toEqual([{ enabled: false, enabled_at: T0, enabled_by: ADMIN, version: 2 }]);
    expect(await auditRows()).toHaveLength(2);
  });
});

describe("PUT /portal-access/{personId}: errors", () => {
  it("C4: an unknown person gives 404 NOT_FOUND and writes nothing", async () => {
    const r = await put(UNKNOWN, { enabled: true });
    expect(r.status).toBe(404);
    expect(r.body).toMatchObject({ status: 404, code: "NOT_FOUND" });
    expect(await accessRows(UNKNOWN)).toEqual([]);
    expect(await auditRows()).toEqual([]);
  });

  it("C5: enabling a person with no CPF gives 422 PERSON_WITHOUT_CPF and writes nothing", async () => {
    const r = await put(NO_CPF, { enabled: true });
    expect(r.status).toBe(422);
    expect(r.headers["content-type"]).toMatch(/^application\/problem\+json/);
    expect(r.body).toMatchObject({ status: 422, code: "PERSON_WITHOUT_CPF" });
    expect(await accessRows(NO_CPF)).toEqual([]);
    expect(await auditRows()).toEqual([]);
  });

  it("C5: disabling a person with no CPF and no row gives 200, enabled false and creates no row", async () => {
    const r = await put(NO_CPF, { enabled: false });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ personId: NO_CPF, enabled: false, enabledAt: null });
    expect(await accessRows(NO_CPF)).toEqual([]);
    expect(await auditRows()).toEqual([]);
  });

  it.each([
    ["a string", { enabled: "true" }],
    ["a missing key", {}],
    ["an extra key", { enabled: true, personId: WITH_CPF }],
  ])("C6: a body with %s gives 400 VALIDATION_FAILED", async (_name, body) => {
    const r = await put(WITH_CPF, body);
    expect(r.status).toBe(400);
    expect(r.body).toMatchObject({ code: "VALIDATION_FAILED" });
    expect(await accessRows(WITH_CPF)).toEqual([]);
  });

  it("C6: a personId that is not a uuid gives 400", async () => {
    expect((await put("nao-e-uuid", { enabled: true })).status).toBe(400);
    expect((await get("nao-e-uuid")).status).toBe(400);
  });

  it("C7: a failing audit insert rolls the portal_access change and the session delete back", async () => {
    await put(WITH_CPF, { enabled: true });
    await seedSession("a".repeat(43), WITH_CPF);
    await client.query(
      "alter table core.audit_log add constraint test_no_disable check (action <> 'PORTAL_ACCESS_DISABLED')",
    );
    try {
      const r = await put(WITH_CPF, { enabled: false });
      expect(r.status).toBe(500);
    } finally {
      await client.query("alter table core.audit_log drop constraint test_no_disable");
    }
    expect(await accessRows(WITH_CPF)).toEqual([{ enabled: true, enabled_at: T0, enabled_by: ADMIN, version: 1 }]);
    expect(await sessionPersons()).toEqual([WITH_CPF]);
  });

  it("C7: a failing audit insert on the first enable leaves no portal_access row", async () => {
    await client.query(
      "alter table core.audit_log add constraint test_no_enable check (action <> 'PORTAL_ACCESS_ENABLED')",
    );
    try {
      expect((await put(WITH_CPF, { enabled: true })).status).toBe(500);
    } finally {
      await client.query("alter table core.audit_log drop constraint test_no_enable");
    }
    expect(await accessRows(WITH_CPF)).toEqual([]);
  });
});

describe("roles", () => {
  it("C8: no session gives 401 on PUT and GET and writes nothing", async () => {
    expect((await request(baseUrl).put(`${URL}/${WITH_CPF}`).send({ enabled: true })).status).toBe(401);
    expect((await request(baseUrl).get(`${URL}/${WITH_CPF}`)).status).toBe(401);
    expect(await accessRows(WITH_CPF)).toEqual([]);
  });

  it("C8: a CLIENT session gives 403 FORBIDDEN on PUT and GET and writes nothing", async () => {
    const token = "k".repeat(43);
    await seedSession(token, WITH_CPF);
    const client403 = request.agent(baseUrl).set("Cookie", `pilla_session=${token}`);
    const putReply = await client403.put(`${URL}/${WITH_CPF}`).send({ enabled: true });
    expect(putReply.status).toBe(403);
    expect(putReply.body).toMatchObject({ code: "FORBIDDEN" });
    expect((await client403.get(`${URL}/${WITH_CPF}`)).status).toBe(403);
    expect(await accessRows(WITH_CPF)).toEqual([]);
  });

  it("C8: the portal cookie of a client does not open the ADMIN routes", async () => {
    const token = "m".repeat(43);
    await seedSession(token, WITH_CPF);
    const r = await request(baseUrl)
      .put(`${URL}/${WITH_CPF}`)
      .set("Cookie", `pilla_portal=${token}`)
      .send({ enabled: true });
    expect(r.status).toBe(401);
  });
});

describe("GET /portal-access/{personId}", () => {
  it("C9: returns the state of an enabled and of a disabled person", async () => {
    await put(WITH_CPF, { enabled: true });
    expect((await get(WITH_CPF)).body).toEqual({
      personId: WITH_CPF,
      enabled: true,
      enabledAt: "2026-11-23T12:00:00.000Z",
    });
    await put(WITH_CPF, { enabled: false });
    expect((await get(WITH_CPF)).body).toEqual({
      personId: WITH_CPF,
      enabled: false,
      enabledAt: "2026-11-23T12:00:00.000Z",
    });
  });

  it("C9: a person who never had a row gives enabled false and enabledAt null", async () => {
    const r = await get(NO_CPF);
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ personId: NO_CPF, enabled: false, enabledAt: null });
  });

  it("C9: an unknown person gives 404 and nothing is written by a read", async () => {
    expect((await get(UNKNOWN)).status).toBe(404);
    await get(WITH_CPF);
    expect(await accessRows(WITH_CPF)).toEqual([]);
    expect(await auditRows()).toEqual([]);
  });
});

describe("integration with the portal guard", () => {
  it("C10: after disabling, the portal guard answers 401 for that person", async () => {
    await put(WITH_CPF, { enabled: true });
    const entry = await request(baseUrl)
      .post("/api/v1/portal/session")
      .set("X-Forwarded-For", "198.51.100.88")
      .send({ cpf: CPF });
    expect(entry.status).toBe(204);
    const raw: unknown = entry.headers["set-cookie"];
    const cookie = (Array.isArray(raw) ? String(raw[0]) : "").split(";")[0] ?? "";
    expect(cookie).toMatch(/^pilla_portal=/);
    await put(WITH_CPF, { enabled: false });
    expect(await sessionPersons()).toEqual([]);
    const again = await request(baseUrl)
      .post("/api/v1/portal/session")
      .set("X-Forwarded-For", "198.51.100.89")
      .send({ cpf: CPF });
    expect(again.status).toBe(401);
  });
});
