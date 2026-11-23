import type { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { migratedTestDb } from "../../db/test-db";
import * as dispatcher from "./outbox-dispatcher";
import { dispatchOutbox, type OutboxConsumer } from "./outbox-dispatcher";
import { OUTBOX_POLL_INTERVAL_MS, OutboxPoller } from "./outbox-poller";
import type { OutboxEvent } from "./outbox-writer";

// E12-F01 C1 a C12: despachante genérico do outbox (E12 D1) com consumidores falsos, e o poller (A13).
const uuid = (n: number): string => `01970000-0000-7000-8000-${String(1000000000000 + n).slice(1)}`;
const AGGREGATE = uuid(1);
const BASE_MS = Date.UTC(2026, 10, 20, 12, 0, 0);
const at = (minutes: number): string => new Date(BASE_MS + minutes * 60000).toISOString();

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
  await client.query("delete from core.processed_events");
  await client.query("delete from core.outbox");
  await client.query("delete from core.audit_log");
});

type Seed = { readonly type?: string; readonly occurredAt?: string; readonly attempts?: number };

async function insertEvent(id: string, seed: Seed = {}): Promise<void> {
  await client.query(
    `insert into core.outbox (id, event_type, event_version, aggregate_id, payload, occurred_at, attempts)
     values ($1, $2, 1, $3, $4, $5, $6)`,
    [id, seed.type ?? "Ping", AGGREGATE, JSON.stringify({ n: 1 }), seed.occurredAt ?? at(0), seed.attempts ?? 0],
  );
}

type OutboxState = { published: boolean; attempts: number; last_error: string | null };

async function outboxState(id: string): Promise<OutboxState | undefined> {
  const result = await client.query<OutboxState>(
    "select published_at is not null as published, attempts, last_error from core.outbox where id = $1",
    [id],
  );
  return result.rows[0];
}

async function processed(): Promise<string[]> {
  const result = await client.query<{ row: string }>(
    "select consumer || ':' || event_id as row from core.processed_events order by consumer, event_id",
  );
  return result.rows.map((r) => r.row);
}

async function count(table: string): Promise<number> {
  const result = await client.query<{ n: number }>(`select count(*)::int as n from ${table}`);
  return result.rows[0]?.n ?? -1;
}

type Fake = { readonly consumer: OutboxConsumer; readonly calls: OutboxEvent[] };

function fakeConsumer(
  name: string,
  eventTypes: readonly string[],
  behavior: (tx: PgDatabase<PgQueryResultHKT>, event: OutboxEvent) => Promise<void> = () => Promise.resolve(),
): Fake {
  const calls: OutboxEvent[] = [];
  return {
    calls,
    consumer: {
      name,
      eventTypes,
      handle: async (tx, event) => {
        calls.push(event);
        await behavior(tx, event);
      },
    },
  };
}

describe("dispatchOutbox: publicação (E12-F01 C1 a C3)", () => {
  it("C1: hands the event to the interested consumer and marks it published", async () => {
    const id = uuid(10);
    await insertEvent(id, { occurredAt: at(0) });
    const a = fakeConsumer("a", ["Ping"]);
    expect(await dispatchOutbox(db, [a.consumer])).toEqual({ published: 1, failed: 0 });
    expect(a.calls).toEqual([
      { id, type: "Ping", version: 1, occurredAt: at(0), aggregateId: AGGREGATE, payload: { n: 1 } },
    ]);
    expect(await outboxState(id)).toEqual({ published: true, attempts: 0, last_error: null });
  });

  it("C2: each consumer only receives the event types it subscribes to", async () => {
    const ping = uuid(11);
    const pong = uuid(12);
    await insertEvent(ping, { type: "Ping", occurredAt: at(0) });
    await insertEvent(pong, { type: "Pong", occurredAt: at(1) });
    const a = fakeConsumer("a", ["Ping"]);
    const b = fakeConsumer("b", ["Pong"]);
    expect(await dispatchOutbox(db, [a.consumer, b.consumer])).toEqual({ published: 2, failed: 0 });
    expect(a.calls.map((e) => e.id)).toEqual([ping]);
    expect(b.calls.map((e) => e.id)).toEqual([pong]);
    expect(await processed()).toEqual([`a:${ping}`, `b:${pong}`]);
  });

  it("C3: an event without an interested consumer is still marked published", async () => {
    const id = uuid(13);
    await insertEvent(id, { type: "Unknown" });
    const a = fakeConsumer("a", ["Ping"]);
    expect(await dispatchOutbox(db, [a.consumer])).toEqual({ published: 1, failed: 0 });
    expect(a.calls).toHaveLength(0);
    expect(await outboxState(id)).toEqual({ published: true, attempts: 0, last_error: null });
    expect(await processed()).toEqual([]);
  });
});

describe("dispatchOutbox: reentrega e processed_events (E12-F01 C4, C5, A9)", () => {
  it("C4: running twice, or again after clearing published_at, never handles the event twice", async () => {
    const id = uuid(20);
    await insertEvent(id);
    const a = fakeConsumer("a", ["Ping"]);
    expect(await dispatchOutbox(db, [a.consumer])).toEqual({ published: 1, failed: 0 });
    expect(await dispatchOutbox(db, [a.consumer])).toEqual({ published: 0, failed: 0 });
    expect(a.calls).toHaveLength(1);
    await client.query("update core.outbox set published_at = null where id = $1", [id]);
    expect(await dispatchOutbox(db, [a.consumer])).toEqual({ published: 1, failed: 0 });
    expect(a.calls).toHaveLength(1);
    expect(await processed()).toEqual([`a:${id}`]);
    expect(await outboxState(id)).toEqual({ published: true, attempts: 0, last_error: null });
  });

  it("C5: a consumer already recorded in processed_events is skipped, the others still run", async () => {
    const id = uuid(21);
    await insertEvent(id);
    await client.query("insert into core.processed_events (consumer, event_id) values ('a', $1)", [id]);
    const a = fakeConsumer("a", ["Ping"]);
    const b = fakeConsumer("b", ["Ping"]);
    expect(await dispatchOutbox(db, [a.consumer, b.consumer])).toEqual({ published: 1, failed: 0 });
    expect(a.calls).toHaveLength(0);
    expect(b.calls.map((e) => e.id)).toEqual([id]);
    expect(await processed()).toEqual([`a:${id}`, `b:${id}`]);
  });
});

describe("dispatchOutbox: falha e limite de tentativas (E12-F01 C6 a C8, A10)", () => {
  it("C6: a failing event gets attempts + 1 and last_error while the rest of the batch is published", async () => {
    const bad = uuid(30);
    const good = uuid(31);
    await insertEvent(bad, { occurredAt: at(0) });
    await insertEvent(good, { occurredAt: at(1) });
    const a = fakeConsumer("a", ["Ping"], (_tx, event) =>
      event.id === bad ? Promise.reject(new Error("boom")) : Promise.resolve(),
    );
    expect(await dispatchOutbox(db, [a.consumer])).toEqual({ published: 1, failed: 1 });
    expect(await outboxState(bad)).toEqual({ published: false, attempts: 1, last_error: "boom" });
    expect(await outboxState(good)).toEqual({ published: true, attempts: 0, last_error: null });
    expect(await processed()).toEqual([`a:${good}`]);
  });

  it("C7: last_error keeps at most 500 characters of the error message", async () => {
    const id = uuid(32);
    await insertEvent(id);
    const a = fakeConsumer("a", ["Ping"], () => Promise.reject(new Error("x".repeat(800))));
    expect(await dispatchOutbox(db, [a.consumer])).toEqual({ published: 0, failed: 1 });
    const state = await outboxState(id);
    expect(state?.last_error).toHaveLength(500);
    expect(state?.last_error).toMatch(/^x+$/);
  });

  it("C8: the fifth failure stops the retries and an event with 5 attempts is no longer read", async () => {
    const fourth = uuid(33);
    const exhausted = uuid(34);
    await insertEvent(fourth, { occurredAt: at(0), attempts: 4 });
    await insertEvent(exhausted, { occurredAt: at(1), attempts: 5 });
    const a = fakeConsumer("a", ["Ping"], () => Promise.reject(new Error("boom")));
    expect(await dispatchOutbox(db, [a.consumer])).toEqual({ published: 0, failed: 1 });
    expect(a.calls.map((e) => e.id)).toEqual([fourth]);
    expect(await outboxState(fourth)).toEqual({ published: false, attempts: 5, last_error: "boom" });
    expect(await dispatchOutbox(db, [a.consumer])).toEqual({ published: 0, failed: 0 });
    expect(a.calls).toHaveLength(1);
    expect(await outboxState(exhausted)).toEqual({ published: false, attempts: 5, last_error: null });
  });
});

describe("dispatchOutbox: rollback do evento (E12-F01 C9, A12)", () => {
  it("C9: an error in a later consumer rolls back the earlier writes and processed_events", async () => {
    const id = uuid(40);
    await insertEvent(id);
    const writer = fakeConsumer("a", ["Ping"], async (tx, event) => {
      await tx.execute(
        sql`insert into core.audit_log (id, actor_type, action, entity_type, entity_id, at)
            values (${uuid(41)}, 'SYSTEM', 'TEST', 'Ping', ${event.aggregateId}, now())`,
      );
    });
    const failing = fakeConsumer("b", ["Ping"], () => Promise.reject(new Error("boom")));
    expect(await dispatchOutbox(db, [writer.consumer, failing.consumer])).toEqual({ published: 0, failed: 1 });
    expect(writer.calls).toHaveLength(1);
    expect(await count("core.audit_log")).toBe(0);
    expect(await processed()).toEqual([]);
    expect(await outboxState(id)).toEqual({ published: false, attempts: 1, last_error: "boom" });
  });
});

describe("dispatchOutbox: ordem e lote (E12-F01 C10, A11)", () => {
  it("C10: reads at most 100 events per run, in occurred_at then id order", async () => {
    // Pares com o mesmo occurred_at: o desempate é o id. Inseridos em ordem inversa.
    const ids = Array.from({ length: 105 }, (_, i) => uuid(100 + i));
    for (let i = 104; i >= 0; i--) {
      await insertEvent(uuid(100 + i), { occurredAt: at(Math.floor(i / 2)) });
    }
    const a = fakeConsumer("a", ["Ping"]);
    expect(await dispatchOutbox(db, [a.consumer])).toEqual({ published: 100, failed: 0 });
    expect(a.calls.map((e) => e.id)).toEqual(ids.slice(0, 100));
    expect(await dispatchOutbox(db, [a.consumer])).toEqual({ published: 5, failed: 0 });
    expect(a.calls.map((e) => e.id)).toEqual(ids);
  });
});

describe("OutboxPoller (E12-F01 C11, C12, A13)", () => {
  const consumers: readonly OutboxConsumer[] = [fakeConsumer("a", ["Ping"]).consumer];

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("C11: calls the dispatcher every 2000 ms with the database and the consumers, and stops on destroy", async () => {
    const spy = vi.spyOn(dispatcher, "dispatchOutbox").mockResolvedValue({ published: 0, failed: 0 });
    const poller = new OutboxPoller(db, consumers);
    expect(OUTBOX_POLL_INTERVAL_MS).toBe(2000);
    poller.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(1999);
    expect(spy).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(db, consumers);
    await vi.advanceTimersByTimeAsync(2000);
    expect(spy).toHaveBeenCalledTimes(2);
    poller.onModuleDestroy();
    await vi.advanceTimersByTimeAsync(10000);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("C12: does not start a new run while the previous one is still running", async () => {
    let finish: (value: dispatcher.DispatchResult) => void = () => undefined;
    const pending = new Promise<dispatcher.DispatchResult>((resolve) => {
      finish = resolve;
    });
    const spy = vi
      .spyOn(dispatcher, "dispatchOutbox")
      .mockReturnValueOnce(pending)
      .mockResolvedValue({ published: 0, failed: 0 });
    const poller = new OutboxPoller(db, consumers);
    poller.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(2000);
    expect(spy).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(6000);
    expect(spy).toHaveBeenCalledTimes(1);
    finish({ published: 0, failed: 0 });
    await vi.advanceTimersByTimeAsync(2000);
    expect(spy).toHaveBeenCalledTimes(2);
    poller.onModuleDestroy();
  });
});
