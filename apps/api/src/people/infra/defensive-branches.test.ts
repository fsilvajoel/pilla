import { describe, expect, it } from "vitest";
import type { Database } from "../../db/database";
import { PeopleService } from "../application/people.service";
import { addressRepository } from "./address-repository";
import { pixKeyRepository } from "./pix-key-repository";

// Banco de mentira para os ramos defensivos que um Postgres de verdade nunca alcança (consulta sem linha, falha
// inesperada). Cada chamada da cadeia do drizzle (select().from().where()...) devolve a mesma cadeia, que resolve `[]`.
const chain: unknown = new Proxy(Function.prototype, {
  get: (_target, property) =>
    property === "then"
      ? (resolve: (rows: unknown[]) => void) => {
          resolve([]);
        }
      : chain,
  apply: () => chain,
});

function dbOf(parts: Record<string, unknown>): Database {
  const db: Record<string, unknown> = { ...parts, transaction: (work: (tx: unknown) => unknown) => work(db) };
  return db as unknown as Database;
}

/** Todas as consultas voltam vazias. */
export function emptyDb(): Database {
  return dbOf({ select: () => chain, insert: () => chain, update: () => chain, delete: () => chain });
}

/** Qualquer acesso ao banco lança `error`. */
export function throwingDb(error: Error): Database {
  const fail = (): never => {
    throw error;
  };
  return dbOf({ select: fail, insert: fail, update: fail, delete: fail });
}

// Ramos defensivos dos repositórios e do serviço, inalcançáveis com Postgres de verdade.
describe("repositories on an empty result", () => {
  it("counts zero addresses, refuses an insert without a row and updates nothing", async () => {
    await addressRepository(emptyDb()).inTransaction(async (store) => {
      expect(await store.countByPerson("p")).toBe(0);
      expect(await store.update("a", { street: "Rua A" })).toBeNull();
      await expect(
        store.insert({
          id: "a",
          personId: "p",
          street: "Rua A",
          number: "1",
          district: "Centro",
          city: "São Paulo",
          state: "SP",
          postalCode: "01001000",
          isPrimary: true,
        }),
      ).rejects.toThrow("address insert returned no row");
    });
  });

  it("counts zero PIX keys, refuses an insert without a row and updates nothing", async () => {
    await pixKeyRepository(emptyDb()).inTransaction(async (store) => {
      expect(await store.countByPerson("p")).toBe(0);
      expect(await store.update("k", { value: "x" })).toBeNull();
      await expect(
        store.insert({ id: "k", ownerPersonId: "p", type: "EMAIL", value: "a@example.com", isPrimary: true }),
      ).rejects.toThrow("pix key insert returned no row");
    });
  });
});

describe("PeopleService on unexpected database results", () => {
  const request = { fullName: "Ana Souza", cpf: "52998224725", phone: "+5511999990000" };

  it("reports NOT_FOUND when the person row is missing", async () => {
    await expect(new PeopleService(emptyDb()).get("p")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("maps a missing referrer foreign key to NOT_FOUND", async () => {
    const error = new Error("insert failed", {
      cause: { code: "23503", constraint: "persons_referred_by_id_fkey" },
    });
    await expect(new PeopleService(throwingDb(error)).create(request)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rethrows an unknown write error", async () => {
    const error = new Error("disk full");
    await expect(new PeopleService(throwingDb(error)).create(request)).rejects.toBe(error);
  });

  it("rethrows a listing failure that is not a bad cursor", async () => {
    const error = new Error("disk full");
    await expect(new PeopleService(throwingDb(error)).list({ limit: 20 })).rejects.toBe(error);
  });
});
