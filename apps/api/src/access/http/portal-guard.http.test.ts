import type { PGlite } from "@electric-sql/pglite";
import { Controller, Get, UseGuards, type INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp } from "../../core/http/test-app";
import { DATABASE, type Database } from "../../db/database";
import { migratedTestDb } from "../../db/test-db";
import { sessionIdOf } from "../domain/session-token";
import { PortalPerson, type PortalActor } from "../public/portal-person";
import { PortalSessionGuard } from "../public/portal-session.guard";

// Guarda do portal (E15 D7, E15-F02 C15 a C21): lê pilla_portal, exige CLIENT viva e reconfere portal_access.
const T0 = new Date("2026-11-23T12:00:00Z");
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const ADMIN = "01970000-0000-7000-8000-000000000f01";
const PERSON = "01970000-0000-7000-8000-000000000f11";
const OTHER = "01970000-0000-7000-8000-000000000f12";
const TOKEN = "t".repeat(43);
const ADMIN_TOKEN = "a".repeat(43);

@Controller("probe")
@UseGuards(PortalSessionGuard)
class ProbeController {
  @Get()
  read(@PortalPerson() person: PortalActor): PortalActor {
    return person;
  }
}

let client: PGlite;
let db: Database;
let app: INestApplication;
let baseUrl: string;

const at = (ms: number): void => {
  vi.setSystemTime(new Date(T0.getTime() + ms));
};
const probe = (cookie?: string): request.Test => {
  const call = request(baseUrl).get("/api/v1/probe");
  return cookie === undefined ? call : call.set("Cookie", cookie);
};
const seedSession = (token: string, personId: string, overrides: { expiresAt?: Date; lastSeenAt?: Date } = {}) =>
  client.query(
    `insert into access.sessions (id, role, person_id, created_at, expires_at, last_seen_at, ip)
     values ($1, 'CLIENT', $2, $3, $4, $5, '203.0.113.5')`,
    [
      sessionIdOf(token),
      personId,
      T0,
      overrides.expiresAt ?? new Date(T0.getTime() + 2 * HOUR),
      overrides.lastSeenAt ?? T0,
    ],
  );
const lastSeen = async (): Promise<Date | undefined> =>
  (await client.query<{ last_seen_at: Date }>("select last_seen_at from access.sessions where role = 'CLIENT'")).rows[0]
    ?.last_seen_at;
const sessionCount = async (): Promise<number> => (await client.query("select id from access.sessions")).rows.length;

beforeAll(async () => {
  const migrated = await migratedTestDb();
  client = migrated.client;
  db = migrated.db;
  app = await createTestApp([ProbeController], [{ provide: DATABASE, useValue: db }], { actor: null });
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
  await client.query("delete from access.portal_access");
  await client.query("delete from access.admin_users");
  await client.query("insert into access.admin_users (id, username, password_hash) values ($1, 'joana', 'x')", [ADMIN]);
  await client.query(
    `insert into access.portal_access (person_id, enabled, enabled_at, enabled_by) values ($1, true, $3, $4), ($2, false, $3, $4)`,
    [PERSON, OTHER, T0, ADMIN],
  );
});
afterEach(() => {
  vi.useRealTimers();
});

describe("PortalSessionGuard: sessions that do not pass", () => {
  it("C15: no cookie gives 401 UNAUTHENTICATED as problem+json with no-store", async () => {
    const r = await probe();
    expect(r.status).toBe(401);
    expect(r.headers["content-type"]).toMatch(/^application\/problem\+json/);
    expect(r.body).toMatchObject({ status: 401, code: "UNAUTHENTICATED" });
    expect(r.headers["cache-control"]).toContain("no-store");
  });

  it.each(["pilla_portal=lixo", "pilla_portal=", `pilla_portal=${"+".repeat(43)}`, `pilla_session=${TOKEN}`])(
    "C16: the cookie %j gives 401",
    async (cookie) => {
      await seedSession(TOKEN, PERSON);
      expect((await probe(cookie)).status).toBe(401);
    },
  );

  it("C17: a token whose session was deleted gives 401", async () => {
    expect((await probe(`pilla_portal=${TOKEN}`)).status).toBe(401);
  });

  it("C18: a session idle for more than 30 minutes gives 401 and its row is deleted", async () => {
    await seedSession(TOKEN, PERSON);
    at(30 * MINUTE + 1000);
    expect((await probe(`pilla_portal=${TOKEN}`)).status).toBe(401);
    expect(await sessionCount()).toBe(0);
  });

  it("C18: a session past the 2 hour ceiling gives 401 even if it was used a minute ago", async () => {
    await seedSession(TOKEN, PERSON, { expiresAt: new Date(T0.getTime() + HOUR) });
    at(25 * MINUTE);
    expect((await probe(`pilla_portal=${TOKEN}`)).status).toBe(200);
    at(50 * MINUTE);
    expect((await probe(`pilla_portal=${TOKEN}`)).status).toBe(200);
    at(HOUR - MINUTE);
    expect((await probe(`pilla_portal=${TOKEN}`)).status).toBe(200);
    at(HOUR + 1000);
    expect((await probe(`pilla_portal=${TOKEN}`)).status).toBe(401);
    expect(await sessionCount()).toBe(0);
  });

  it("C19: disabling portal_access after the login makes the next call 401", async () => {
    await seedSession(TOKEN, PERSON);
    expect((await probe(`pilla_portal=${TOKEN}`)).status).toBe(200);
    await client.query("update access.portal_access set enabled = false where person_id = $1", [PERSON]);
    expect((await probe(`pilla_portal=${TOKEN}`)).status).toBe(401);
  });

  it("C19: a session of a person with no portal_access row gives 401", async () => {
    await seedSession(TOKEN, "01970000-0000-7000-8000-000000000f99");
    expect((await probe(`pilla_portal=${TOKEN}`)).status).toBe(401);
  });

  it("C19: a session of a person with access disabled gives 401", async () => {
    await seedSession(TOKEN, OTHER);
    expect((await probe(`pilla_portal=${TOKEN}`)).status).toBe(401);
  });

  it("C20: an ADMIN session does not pass, even under the portal cookie name", async () => {
    await client.query(
      `insert into access.sessions (id, role, admin_user_id, created_at, expires_at, last_seen_at, ip)
       values ($1, 'ADMIN', $2, $3, $4, $3, '203.0.113.5')`,
      [sessionIdOf(ADMIN_TOKEN), ADMIN, T0, new Date(T0.getTime() + HOUR)],
    );
    expect((await probe(`pilla_portal=${ADMIN_TOKEN}`)).status).toBe(401);
    expect((await probe(`pilla_session=${ADMIN_TOKEN}`)).status).toBe(401);
  });
});

describe("PortalSessionGuard: a valid session", () => {
  it("C15: hands over the personId of the session, and only that", async () => {
    await seedSession(TOKEN, PERSON);
    const r = await probe(`pilla_portal=${TOKEN}`);
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ personId: PERSON });
    expect(r.headers["cache-control"]).toContain("no-store");
  });

  it("C15: finds the cookie among others", async () => {
    await seedSession(TOKEN, PERSON);
    expect((await probe(`a=1; pilla_portal=${TOKEN}; b=2`)).status).toBe(200);
  });

  it("C16: renews last_seen_at to now and keeps the session alive past 30 minutes of total age", async () => {
    await seedSession(TOKEN, PERSON);
    at(20 * MINUTE);
    expect((await probe(`pilla_portal=${TOKEN}`)).status).toBe(200);
    expect(await lastSeen()).toEqual(new Date(T0.getTime() + 20 * MINUTE));
    at(45 * MINUTE);
    expect((await probe(`pilla_portal=${TOKEN}`)).status).toBe(200);
  });

  it("C16: last_seen_at never goes past expires_at", async () => {
    const expiresAt = new Date(T0.getTime() + 10 * MINUTE);
    await seedSession(TOKEN, PERSON, { expiresAt });
    at(9 * MINUTE);
    expect((await probe(`pilla_portal=${TOKEN}`)).status).toBe(200);
    expect((await lastSeen())?.getTime()).toBeLessThanOrEqual(expiresAt.getTime());
  });

  it("C21: sessions of other people stay untouched", async () => {
    await seedSession(TOKEN, PERSON);
    await seedSession("u".repeat(43), OTHER, { lastSeenAt: new Date(T0.getTime() - 5 * MINUTE) });
    at(MINUTE);
    await probe(`pilla_portal=${TOKEN}`);
    const rows = (
      await client.query<{ person_id: string; last_seen_at: Date }>(
        "select person_id, last_seen_at from access.sessions",
      )
    ).rows;
    expect(rows.find((row) => row.person_id === OTHER)?.last_seen_at).toEqual(new Date(T0.getTime() - 5 * MINUTE));
  });
});
