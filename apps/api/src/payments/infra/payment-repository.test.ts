import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import type { Database } from "../../db/database";
import { insertPaymentWithAudit } from "./payment-repository";

// Banco falso em que o insert devolve zero linhas: exercita a defesa contra retorno vazio, que o banco real
// nunca produz (a chave única devolve a linha guardada).
const empty = Promise.resolve([] as never[]);
const fakeTx = { insert: () => ({ values: () => ({ onConflictDoUpdate: () => ({ returning: () => empty }) }) }) };
const fakeDb = {
  transaction: <T>(work: (tx: typeof fakeTx) => Promise<T>) => work(fakeTx),
} as unknown as PgDatabase<PgQueryResultHKT> as Database;

describe("insertPaymentWithAudit: banco que devolve zero linhas", () => {
  it("fails when the insert returns no row, without writing the audit", async () => {
    let audited = false;
    const row = {
      id: "x",
      loanId: "x",
      personId: "x",
      accountId: "x",
      paidAt: "2026-11-20",
      amountCents: 1,
      method: "PIX",
      channel: "ADMIN",
      status: "PENDING_REVIEW",
      createdBy: "x",
    };
    await expect(
      insertPaymentWithAudit(fakeDb, row, () => {
        audited = true;
        throw new Error("não deve auditar");
      }),
    ).rejects.toThrow("payment insert returned no row");
    expect(audited).toBe(false);
  });
});
