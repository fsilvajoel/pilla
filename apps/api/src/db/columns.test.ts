import { pgTable } from "drizzle-orm/pg-core";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { cents, instant } from "./columns";

// Tipos de coluna compartilhados (RFC-005 §1, ADR-0004): o SQL gerado e o tipo que o código recebe.
describe("shared column builders", () => {
  const { columns } = getTableConfig(pgTable("sample", { amount: cents("amount_cents"), at: instant("paid_at") }));
  const [amount, at] = columns;

  it("stores money as bigint and reads it as a JS number (ADR-0004)", () => {
    expect(amount?.getSQLType()).toBe("bigint");
    expect(amount?.columnType).toBe("PgBigInt53");
  });

  it("stores instants with time zone and reads them as Date", () => {
    expect(at?.getSQLType()).toBe("timestamp with time zone");
    expect(at?.columnType).toBe("PgTimestamp");
  });
});
