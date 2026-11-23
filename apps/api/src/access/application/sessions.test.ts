import type { PGlite } from "@electric-sql/pglite";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { migratedTestDb, type MigratedTestDb } from "../../db/test-db";
import { sessionIdOf } from "../domain/session-token";
import { createAdminSession, endSession, resolveAdminSession } from "./sessions";

// Serviço de sessão do ADMIN (E14 D3, E14-F02 C12 a C16): inatividade de 2 h, teto de 12 h, admin ativo,
// last_seen_at no máximo uma vez por minuto e sessão vencida apagada quando aparece. Relógio falso só no Date.
const ADMIN = "01970000-0000-7000-8000-000000000e01";
const IP = "203.0.113.7";
const T0 = new Date("2026-11-23T12:00:00Z");
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

type SessionDbRow = {
  id: string;
  role: string;
  admin_user_id: string | null;
  person_id: string | null;
  ip: string;
  created_at: Date;
  last_seen_at: Date;
  expires_at: Date;
};

let client: PGlite;
let db: PgliteDatabase;
let migrated: MigratedTestDb;

const at = (ms: number): void => {
  vi.setSystemTime(new Date(T0.getTime() + ms));
};
const rowsOf = async (): Promise<SessionDbRow[]> =>
  (await client.query<SessionDbRow>("select * from access.sessions")).rows;

beforeAll(async () => {
  migrated = await migratedTestDb();
  ({ db, client } = migrated);
});
afterAll(async () => migrated.close());
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  at(0);
  await client.query("delete from access.sessions");
  await client.query("delete from access.admin_users");
  await client.query(
    "insert into access.admin_users (id, username, password_hash, active) values ($1, 'joana', '$argon2id$ficticio', true)",
    [ADMIN],
  );
});
afterEach(() => {
  vi.useRealTimers();
});

describe("createAdminSession", () => {
  it("stores only the SHA-256 of the token, with role ADMIN, the ip and the clock of the API", async () => {
    const { token, expiresAt } = await createAdminSession(db, ADMIN, IP);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(expiresAt).toEqual(new Date("2026-11-24T00:00:00Z"));
    const rows = await rowsOf();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: sessionIdOf(token),
      role: "ADMIN",
      admin_user_id: ADMIN,
      person_id: null,
      ip: IP,
      created_at: T0,
      last_seen_at: T0,
      expires_at: new Date("2026-11-24T00:00:00Z"),
    });
    expect(JSON.stringify(rows)).not.toContain(token);
  });
});

describe("resolveAdminSession", () => {
  it("C12: gives the admin of a live session", async () => {
    const { token } = await createAdminSession(db, ADMIN, IP);
    at(10 * MINUTE);
    expect(await resolveAdminSession(db, token)).toEqual({ id: ADMIN, username: "joana", role: "ADMIN" });
  });

  it("C12: gives null for an unknown token", async () => {
    await createAdminSession(db, ADMIN, IP);
    expect(await resolveAdminSession(db, "A".repeat(43))).toBeNull();
    expect(await rowsOf()).toHaveLength(1);
  });

  it("C13: a session idle for a bit less than 2 h is still live", async () => {
    const { token } = await createAdminSession(db, ADMIN, IP);
    at(2 * HOUR - MINUTE);
    expect(await resolveAdminSession(db, token)).toEqual({ id: ADMIN, username: "joana", role: "ADMIN" });
  });

  it("C13: a session idle for more than 2 h gives null and its row is deleted", async () => {
    const { token } = await createAdminSession(db, ADMIN, IP);
    at(2 * HOUR + 1000);
    expect(await resolveAdminSession(db, token)).toBeNull();
    expect(await rowsOf()).toEqual([]);
  });

  it("C13: use within the 2 h pushes the idle limit forward", async () => {
    const { token } = await createAdminSession(db, ADMIN, IP);
    at(HOUR + 30 * MINUTE);
    expect(await resolveAdminSession(db, token)).not.toBeNull();
    at(3 * HOUR);
    expect(await resolveAdminSession(db, token)).toEqual({ id: ADMIN, username: "joana", role: "ADMIN" });
  });

  it("C14: a session in use is cut at 12 h after login and its row is deleted", async () => {
    const { token } = await createAdminSession(db, ADMIN, IP);
    for (let hour = 1; hour <= 11; hour++) {
      at(hour * HOUR);
      expect(await resolveAdminSession(db, token)).not.toBeNull();
    }
    at(12 * HOUR - MINUTE);
    expect(await resolveAdminSession(db, token)).not.toBeNull();
    at(12 * HOUR + 1000);
    expect(await resolveAdminSession(db, token)).toBeNull();
    expect(await rowsOf()).toEqual([]);
  });

  it("C14: a session past its expires_at gives null and its row is deleted", async () => {
    const { token } = await createAdminSession(db, ADMIN, IP);
    await client.query("update access.sessions set expires_at = $1", [new Date(T0.getTime() + 5 * MINUTE)]);
    at(6 * MINUTE);
    expect(await resolveAdminSession(db, token)).toBeNull();
    expect(await rowsOf()).toEqual([]);
  });

  it("C15: a session of an inactive admin gives null", async () => {
    const { token } = await createAdminSession(db, ADMIN, IP);
    await client.query("update access.admin_users set active = false where id = $1", [ADMIN]);
    at(MINUTE);
    expect(await resolveAdminSession(db, token)).toBeNull();
  });

  it("C16: last_seen_at does not move when it is at most 1 minute old", async () => {
    const { token } = await createAdminSession(db, ADMIN, IP);
    at(30_000);
    await resolveAdminSession(db, token);
    at(MINUTE);
    await resolveAdminSession(db, token);
    expect((await rowsOf())[0]?.last_seen_at).toEqual(T0);
  });

  it("C16: last_seen_at moves to now when it is more than 1 minute old", async () => {
    const { token } = await createAdminSession(db, ADMIN, IP);
    at(MINUTE + 1000);
    await resolveAdminSession(db, token);
    expect((await rowsOf())[0]?.last_seen_at).toEqual(new Date("2026-11-23T12:01:01Z"));
  });
});

describe("endSession", () => {
  it("deletes the row of the token and leaves the others", async () => {
    const first = await createAdminSession(db, ADMIN, IP);
    const second = await createAdminSession(db, ADMIN, IP);
    await endSession(db, first.token);
    expect((await rowsOf()).map((row) => row.id)).toEqual([sessionIdOf(second.token)]);
    expect(await resolveAdminSession(db, first.token)).toBeNull();
  });

  it("does nothing for an unknown token", async () => {
    await createAdminSession(db, ADMIN, IP);
    await expect(endSession(db, "B".repeat(43))).resolves.toBeUndefined();
    expect(await rowsOf()).toHaveLength(1);
  });
});
