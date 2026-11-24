import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Database } from "../../db/database";
import { insertRow, testIds } from "../../db/table-contract";
import { migratedTestDb } from "../../db/test-db";
import { PORTAL_ATTEMPT_LIMIT, PORTAL_ATTEMPT_WINDOW_MS } from "./portal-policy";
import { admitAttempt } from "./portal-rate-limit";
import { enterPortal } from "./portal-session-service";

// Limite por IP do portal (RN-A04, CA-09b, E15 D4): 30 tentativas em 60 s, janela deslizante sobre access_logs.
const IP = "203.0.113.10";
const OTHER_IP = "203.0.113.11";
const KEY = "chave-de-teste-do-hash-com-mais-de-32-caracteres";
const NOW = new Date("2026-11-23T12:00:00Z");
const SECOND = 1000;
const VALID_CPF = "52998224725";

let client: PGlite;
let db: Database;
const id = testIds();

const seed = (ip: string, ageMs: number, result = "NOT_FOUND"): Promise<unknown> =>
  insertRow(client, "access.access_logs", {
    id: id(),
    ip,
    cpf_hash: "a".repeat(64),
    result,
    at: new Date(NOW.getTime() - ageMs),
  });
const seedMany = async (count: number, ip: string, ageMs: number, result?: string): Promise<void> => {
  for (let i = 0; i < count; i++) await seed(ip, ageMs, result);
};
const admit = (ip: string, now = NOW): ReturnType<typeof admitAttempt> =>
  db.transaction((tx) => admitAttempt(tx, ip, now));

beforeAll(async () => {
  const migrated = await migratedTestDb();
  client = migrated.client;
  db = migrated.db;
});
afterAll(async () => client.close());
beforeEach(async () => {
  await client.query("delete from access.access_logs");
});

describe("admitAttempt", () => {
  it("C1: the policy is 30 attempts in 60 seconds", () => {
    expect(PORTAL_ATTEMPT_LIMIT).toBe(30);
    expect(PORTAL_ATTEMPT_WINDOW_MS).toBe(60 * SECOND);
  });

  it("C1: an IP with no attempts is admitted", async () => {
    expect(await admit(IP)).toEqual({ admitted: true });
  });

  it("C1: 29 attempts inside the window still admit the 30th", async () => {
    await seedMany(29, IP, 10 * SECOND);
    expect(await admit(IP)).toEqual({ admitted: true });
  });

  it("C1: 30 attempts inside the window block the 31st", async () => {
    await seedMany(30, IP, 10 * SECOND);
    expect((await admit(IP)).admitted).toBe(false);
  });

  it("C2: another IP is not affected by a blocked one", async () => {
    await seedMany(30, IP, 10 * SECOND);
    expect(await admit(OTHER_IP)).toEqual({ admitted: true });
  });

  it("C3: Retry-After is the seconds until the oldest counted attempt leaves the window", async () => {
    await seedMany(29, IP, 5 * SECOND);
    await seed(IP, 40 * SECOND);
    expect(await admit(IP)).toEqual({ admitted: false, retryAfterSeconds: 20 });
  });

  it("C3: Retry-After rounds up and is at least 1", async () => {
    await seedMany(30, IP, PORTAL_ATTEMPT_WINDOW_MS - 400);
    expect(await admit(IP)).toEqual({ admitted: false, retryAfterSeconds: 1 });
  });

  it("C4: the IP enters again once the window empties (injected clock)", async () => {
    await seedMany(30, IP, 10 * SECOND);
    expect((await admit(IP)).admitted).toBe(false);
    expect(await admit(IP, new Date(NOW.getTime() + 51 * SECOND))).toEqual({ admitted: true });
  });

  it("C4: an attempt exactly 60 seconds old no longer counts", async () => {
    await seedMany(30, IP, PORTAL_ATTEMPT_WINDOW_MS);
    expect(await admit(IP)).toEqual({ admitted: true });
  });

  it("C5: RATE_LIMITED rows do not count", async () => {
    await seedMany(29, IP, 10 * SECOND);
    await seedMany(20, IP, 5 * SECOND, "RATE_LIMITED");
    expect(await admit(IP)).toEqual({ admitted: true });
  });

  it("C5: every other result counts", async () => {
    await seedMany(10, IP, SECOND, "OK");
    await seedMany(10, IP, SECOND, "NOT_FOUND");
    await seedMany(10, IP, SECOND, "DISABLED");
    expect((await admit(IP)).admitted).toBe(false);
  });
});

describe("enterPortal under parallel attempts", () => {
  it("C6: 40 parallel attempts from one IP let at most 30 through", async () => {
    const outcomes = await Promise.all(
      Array.from({ length: 40 }, () => enterPortal(db, { body: { cpf: VALID_CPF }, ip: IP, hashKey: KEY, now: NOW })),
    );
    const blocked = outcomes.filter((outcome) => outcome.kind === "RATE_LIMITED");
    expect(blocked.length).toBeGreaterThanOrEqual(10);
    const { rows } = await client.query<{ result: string; total: string }>(
      "select result, count(*) as total from access.access_logs group by result",
    );
    const byResult = Object.fromEntries(rows.map((row) => [row.result, Number(row.total)]));
    expect(byResult["NOT_FOUND"]).toBe(30);
    expect(byResult["RATE_LIMITED"]).toBe(10);
  });
});
