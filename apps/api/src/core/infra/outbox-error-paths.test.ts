import type { PGlite } from "@electric-sql/pglite";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { migratedTestDb } from "../../db/test-db";
import * as dispatcher from "./outbox-dispatcher";
import { dispatchOutbox } from "./outbox-dispatcher";
import { OutboxPoller } from "./outbox-poller";

// Caminhos de erro que os testes protegidos não alcançam: lançamento que não é Error e falha de leitura do poller.
const ID = "01970000-0000-7000-8000-000000000001";

let client: PGlite;
let db: PgliteDatabase;

beforeAll(async () => {
  const migrated = await migratedTestDb();
  client = migrated.client;
  db = migrated.db;
});
afterAll(async () => {
  await client.close();
});
beforeEach(async () => {
  await client.query("delete from core.outbox");
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("outbox error paths", () => {
  it("records a thrown non-Error value as last_error", async () => {
    await client.query(
      `insert into core.outbox (id, event_type, event_version, aggregate_id, payload, occurred_at)
       values ($1, 'Ping', 1, $1, '{}', now())`,
      [ID],
    );
    const consumer: dispatcher.OutboxConsumer = {
      name: "a",
      eventTypes: ["Ping"],
      handle: vi.fn<dispatcher.OutboxConsumer["handle"]>().mockRejectedValue("plain text"),
    };
    expect(await dispatchOutbox(db, [consumer])).toEqual({ published: 0, failed: 1 });
    const row = await client.query<{ last_error: string }>("select last_error from core.outbox where id = $1", [ID]);
    expect(row.rows[0]?.last_error).toBe("plain text");
  });

  it.each([new Error("db down"), "db down"])(
    "poller survives a failing run and keeps polling (%s)",
    async (failure) => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
      const spy = vi.spyOn(dispatcher, "dispatchOutbox").mockRejectedValue(failure);
      const poller = new OutboxPoller(db, []);
      poller.onApplicationBootstrap();
      await vi.advanceTimersByTimeAsync(4000);
      expect(spy).toHaveBeenCalledTimes(2);
      poller.onModuleDestroy();
    },
  );
});
