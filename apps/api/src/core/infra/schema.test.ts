import type { PGlite } from "@electric-sql/pglite";
import { eq, isNull } from "drizzle-orm";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migratedTestDb } from "../../db/test-db";
import { outbox, processedEvents } from "./schema";

const eventId = "01970000-0000-7000-8000-000000000001";
const aggregateId = "01970000-0000-7000-8000-0000000000aa";

describe("core schema (RFC-005 §2)", () => {
  let db: PgliteDatabase;
  let client: PGlite;
  beforeAll(async () => ({ db, client } = await migratedTestDb()));
  afterAll(async () => client.close());

  it("stores an outbox event as pending with zero attempts", async () => {
    await db.insert(outbox).values({
      id: eventId,
      eventType: "PaymentConfirmed",
      eventVersion: 1,
      aggregateId,
      payload: { amountCents: "1500" },
      occurredAt: new Date("2026-11-15T12:00:00Z"),
    });
    const pending = await db.select().from(outbox).where(isNull(outbox.publishedAt));
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ attempts: 0, lastError: null, payload: { amountCents: "1500" } });
  });

  it("indexes only pending events (partial index on occurred_at)", async () => {
    const { rows } = await client.query<{ indexdef: string }>(
      "select indexdef from pg_indexes where schemaname = 'core' and indexname = 'outbox_pending_idx'",
    );
    expect(rows[0]?.indexdef).toMatch(/\(occurred_at\) WHERE \(published_at IS NULL\)/);
  });

  it("refuses the same event twice for the same consumer, accepts it for another", async () => {
    await db.insert(processedEvents).values({ consumer: "treasury", eventId });
    await expect(db.insert(processedEvents).values({ consumer: "treasury", eventId })).rejects.toThrow();
    await db.insert(processedEvents).values({ consumer: "lending", eventId });
    const rows = await db.select().from(processedEvents).where(eq(processedEvents.eventId, eventId));
    expect(rows.map((r) => r.consumer).sort()).toEqual(["lending", "treasury"]);
    expect(rows[0]?.processedAt).toBeInstanceOf(Date);
  });
});
