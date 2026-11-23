import type { PGlite } from "@electric-sql/pglite";
import { Controller, Get, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../../app.module";
import { hashPassword } from "../../access/domain/password";
import { DATABASE_HANDLE } from "../../db/database";
import { migratedTestDb } from "../../db/test-db";
import type { RequestActor } from "../public/actor";
import { CurrentActor } from "./actor";
import { configureApp } from "./configure-app";
import type { ApiEnv } from "./env";
import { TEST_ADMIN_ACTOR } from "./test-actor";
import { createTestApp } from "./test-app";

// Ator da requisição (E14 D7, D8; E14-F03 C9, C10, C13). Senha fictícia, só deste teste.
const env: ApiEnv = { host: "127.0.0.1", port: 3000, databaseUrl: "postgres://u:p@127.0.0.1:1/pilla" };
const ADMIN = "01970000-0000-7000-8000-000000000f11";
const PASSWORD = "senha ficticia de teste 11";
const PROBE = "/api/v1/probe-actor";

type ActorBody = { actor: RequestActor | null };

@Controller("probe-actor")
class ProbeController {
  @Get()
  whoami(@CurrentActor() actor: RequestActor | undefined): ActorBody {
    return { actor: actor ?? null };
  }
}

describe("actor ip through the real guard", () => {
  let client: PGlite;
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const migrated = await migratedTestDb();
    client = migrated.client;
    await client.query(
      `insert into access.admin_users (id, username, password_hash, active) values ($1, 'ana', $2, true)`,
      [ADMIN, await hashPassword(PASSWORD)],
    );
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule.forRoot(env)],
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

  async function token(): Promise<string> {
    const res = await request(baseUrl)
      .post("/api/v1/auth/admin/login")
      .set("X-Forwarded-For", "192.0.2.50")
      .send({ username: "ana", password: PASSWORD });
    expect(res.status).toBe(200);
    const raw: unknown = res.headers["set-cookie"];
    const cookies = Array.isArray(raw) ? raw.filter((c): c is string => typeof c === "string") : [];
    const pair = cookies.find((c) => c.startsWith("pilla_session=")) ?? "";
    return pair.split(";")[0]?.slice("pilla_session=".length) ?? "";
  }

  it("C9: from 127.0.0.1 the actor ip is the first X-Forwarded-For address", async () => {
    const cookie = `pilla_session=${await token()}`;
    const res = await request(baseUrl).get(PROBE).set("Cookie", cookie).set("X-Forwarded-For", "203.0.113.7, 10.0.0.1");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ actor: { type: "ADMIN", adminUserId: ADMIN, ip: "203.0.113.7" } });
  });

  it("C10: without X-Forwarded-For the actor ip is the connection address", async () => {
    const cookie = `pilla_session=${await token()}`;
    const res = await request(baseUrl).get(PROBE).set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ actor: { type: "ADMIN", adminUserId: ADMIN, ip: "127.0.0.1" } });
  });
});

describe("createTestApp actor option", () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("C13: without the option the controller receives TEST_ADMIN_ACTOR, with no cookie", async () => {
    app = await createTestApp([ProbeController]);
    const res = await request(await app.getUrl()).get(PROBE);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ actor: TEST_ADMIN_ACTOR });
  });

  it("C13: TEST_ADMIN_ACTOR is an ADMIN with a fixed uuid", () => {
    expect(TEST_ADMIN_ACTOR.type).toBe("ADMIN");
    expect(TEST_ADMIN_ACTOR.adminUserId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("C13: with {actor: null} the controller sees no actor", async () => {
    app = await createTestApp([ProbeController], [], { actor: null });
    const res = await request(await app.getUrl()).get(PROBE);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ actor: null });
  });

  it("C13: a given actor reaches the controller as is", async () => {
    const actor: RequestActor = { type: "ADMIN", adminUserId: ADMIN, ip: "198.51.100.20" };
    app = await createTestApp([ProbeController], [], { actor });
    const res = await request(await app.getUrl()).get(PROBE);
    expect(res.body).toEqual({ actor });
  });
});
