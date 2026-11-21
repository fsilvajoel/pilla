import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { migratedTestDb, type MigratedTestDb } from "../../db/test-db";
import { isActiveAccount } from "./account-lookup";

const ACTIVE_ID = "01970000-0000-7000-8000-000000000001";
const INACTIVE_ID = "01970000-0000-7000-8000-000000000002";
const UNKNOWN_ID = "01970000-0000-7000-8000-000000000099";

let handle: MigratedTestDb;

beforeAll(async () => {
  handle = await migratedTestDb();
});
afterAll(async () => handle.close());
beforeEach(async () => {
  await handle.client.query("delete from treasury.accounts");
  await handle.client.query(
    `insert into treasury.accounts (id, name, active) values ($1, 'Conta ativa', true), ($2, 'Conta inativa', false)`,
    [ACTIVE_ID, INACTIVE_ID],
  );
});

describe("treasury public: isActiveAccount", () => {
  it("C3: is true for an existing active account", async () => {
    expect(await isActiveAccount(handle.db, ACTIVE_ID)).toBe(true);
  });

  it("C4: is false for an inactive account", async () => {
    expect(await isActiveAccount(handle.db, INACTIVE_ID)).toBe(false);
  });

  it("C5: is false for an unknown account", async () => {
    expect(await isActiveAccount(handle.db, UNKNOWN_ID)).toBe(false);
  });
});
