import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { loanRepository, type LoanStore } from "./loan-repository";

// Banco falso em que toda consulta devolve zero linhas: exercita as defesas contra retorno vazio,
// que um banco real nunca produz nas operações abaixo.
const empty = Promise.resolve([] as never[]);
const insertChain = {
  values: () => ({ returning: () => empty, onConflictDoUpdate: () => ({ returning: () => empty }) }),
};
const updateChain = { set: () => ({ where: () => ({ returning: () => empty }) }) };
const fakeTx = { insert: () => insertChain, update: () => updateChain };
const fakeDb = {
  transaction: <T>(work: (tx: typeof fakeTx) => Promise<T>) => work(fakeTx),
} as unknown as PgDatabase<PgQueryResultHKT>;

function withStore<T>(work: (store: LoanStore) => Promise<T>): Promise<T> {
  return loanRepository(fakeDb).inTransaction(work);
}

describe("loanRepository: banco que devolve zero linhas", () => {
  it("nextLoanNumber fails when the sequence returns no row", async () => {
    await expect(withStore((store) => store.nextLoanNumber(2026))).rejects.toThrow(
      "loan number sequence returned no row",
    );
  });

  it("each write that must return the row fails when none comes back", async () => {
    await expect(withStore((store) => store.cancel("x"))).rejects.toThrow("loan cancel returned no row");
    await expect(withStore((store) => store.updateDraft("x", {}))).rejects.toThrow("loan update returned no row");
    await expect(withStore((store) => store.activate("x", "2026-11-14", "y"))).rejects.toThrow(
      "loan activate returned no row",
    );
    await expect(withStore((store) => store.settleOrigin("x", "RENEWED"))).rejects.toThrow(
      "origin settle returned no row",
    );
  });
});
