import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import type { Database } from "../../db/database";
import {
  insertPaymentWithAudit,
  markPaymentConfirmed,
  markPaymentRejected,
  markPaymentReversed,
} from "./payment-repository";

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

describe("marcações de status: banco que devolve zero linhas", () => {
  const updateTx = { update: () => ({ set: () => ({ where: () => ({ returning: () => empty }) }) }) };
  const tx = updateTx as unknown as PgDatabase<PgQueryResultHKT>;
  const at = new Date("2026-11-20T10:00:00Z");

  it("confirm fails when the update returns no row", async () => {
    await expect(
      markPaymentConfirmed(tx, "x", { confirmedAt: at, confirmedBy: "u", isRecovery: false }),
    ).rejects.toThrow("payment confirm returned no row");
  });

  it("reject fails when the update returns no row", async () => {
    await expect(markPaymentRejected(tx, "x", { rejectedAt: at, rejectedBy: "u", reason: "r" })).rejects.toThrow(
      "payment reject returned no row",
    );
  });

  it("reverse fails when the update returns no row", async () => {
    await expect(markPaymentReversed(tx, "x", { reversedAt: at, reversedBy: "u", reason: "r" })).rejects.toThrow(
      "payment reverse returned no row",
    );
  });
});
