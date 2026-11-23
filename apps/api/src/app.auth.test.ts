import type { PGlite } from "@electric-sql/pglite";
import { type INestApplication, RequestMethod } from "@nestjs/common";
import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { ModulesContainer, Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hashPassword } from "./access/domain/password";
import { AppModule } from "./app.module";
import { configureApp } from "./core/http/configure-app";
import type { ApiEnv } from "./core/http/env";
import { DATABASE_HANDLE } from "./db/database";
import { migratedTestDb } from "./db/test-db";

// App inteiro com o guard global (E14 D7, D8; E14-F03 C11, C12). Senha fictícia, só deste teste.
const env: ApiEnv = { host: "127.0.0.1", port: 3000, databaseUrl: "postgres://u:p@127.0.0.1:1/pilla" };
const ADMIN = "01970000-0000-7000-8000-000000000f31";
const PASSWORD = "senha ficticia de teste 31";
const ROUTES = ["/api/v1/people", "/api/v1/loans"];
const SOME_ID = "01970000-0000-7000-8000-000000000f39";
/** As únicas rotas abertas (E14 D7). Qualquer outra rota do app tem de exigir sessão. */
const PUBLIC_ROUTES = ["GET /api/v1/health", "GET /api/v1/openapi.json", "POST /api/v1/auth/admin/login"];

type Verb = "get" | "post" | "put" | "patch" | "delete";
type Route = { readonly verb: Verb; readonly path: string };

const VERBS: ReadonlyMap<RequestMethod, Verb> = new Map([
  [RequestMethod.GET, "get"],
  [RequestMethod.POST, "post"],
  [RequestMethod.PUT, "put"],
  [RequestMethod.PATCH, "patch"],
  [RequestMethod.DELETE, "delete"],
]);

const routeKey = (r: Route): string => `${r.verb.toUpperCase()} ${r.path}`;

/** Todas as rotas registradas nos controllers do AppModule, lidas dos metadados do Nest (com :id trocado por um uuid). */
function registeredRoutes(): Route[] {
  const reflector = app.get(Reflector);
  const routes: Route[] = [];
  for (const mod of app.get(ModulesContainer).values()) {
    for (const wrapper of mod.controllers.values()) {
      const controller = wrapper.metatype;
      if (typeof controller !== "function") continue;
      const base = reflector.get<string | undefined>(PATH_METADATA, controller) ?? "";
      const proto: object = controller.prototype as object;
      for (const name of Object.getOwnPropertyNames(proto)) {
        const handler: unknown = Reflect.get(proto, name);
        if (name === "constructor" || typeof handler !== "function") continue;
        const verb = VERBS.get(reflector.get<RequestMethod>(METHOD_METADATA, handler));
        const sub = reflector.get<string | undefined>(PATH_METADATA, handler);
        if (verb === undefined || sub === undefined) continue;
        const parts = [base, sub].flatMap((p) => p.split("/")).filter((p) => p !== "");
        const path = `/api/v1/${parts.map((p) => (p.startsWith(":") ? SOME_ID : p)).join("/")}`;
        routes.push({ verb, path });
      }
    }
  }
  return routes;
}

let client: PGlite;
let app: INestApplication;
let baseUrl: string;

beforeAll(async () => {
  const migrated = await migratedTestDb();
  client = migrated.client;
  await client.query(
    `insert into access.admin_users (id, username, password_hash, active) values ($1, 'joana', $2, true)`,
    [ADMIN, await hashPassword(PASSWORD)],
  );
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

describe("AppModule with the global admin guard", () => {
  it.each(ROUTES)("C11: GET %s without a cookie gives 401 UNAUTHENTICATED", async (route) => {
    const res = await request(baseUrl).get(route);
    expect(res.status).toBe(401);
    expect(String(res.headers["content-type"])).toMatch(/^application\/problem\+json/);
    expect(res.body).toMatchObject({ status: 401, code: "UNAUTHENTICATED" });
  });

  it.each(ROUTES)("C12: GET %s gives 200 after logging in", async (route) => {
    const login = await request(baseUrl)
      .post("/api/v1/auth/admin/login")
      .set("X-Forwarded-For", "192.0.2.31")
      .send({ username: "joana", password: PASSWORD });
    expect(login.status).toBe(200);
    const raw: unknown = login.headers["set-cookie"];
    const cookies = Array.isArray(raw) ? raw.filter((c): c is string => typeof c === "string") : [];
    const cookie = (cookies.find((c) => c.startsWith("pilla_session=")) ?? "").split(";")[0] ?? "";
    expect(cookie).toMatch(/^pilla_session=[A-Za-z0-9_-]{43}$/);
    const res = await request(baseUrl).get(route).set("Cookie", cookie);
    expect(res.status).toBe(200);
  });

  it("C11: every route outside the public list gives 401 without a cookie", async () => {
    const routes = registeredRoutes();
    const keys = routes.map(routeKey);
    expect(keys).toEqual(expect.arrayContaining([...PUBLIC_ROUTES, "GET /api/v1/people", "GET /api/v1/auth/me"]));
    const mismatches: string[] = [];
    for (const route of routes) {
      const res = await request(baseUrl)[route.verb](route.path);
      const isPublic = PUBLIC_ROUTES.includes(routeKey(route));
      if (isPublic === (res.status === 401)) mismatches.push(`${routeKey(route)} -> ${String(res.status)}`);
    }
    expect(mismatches).toEqual([]);
  });
});
