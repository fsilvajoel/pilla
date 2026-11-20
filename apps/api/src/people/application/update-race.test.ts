import { describe, expect, it } from "vitest";
import type { AddressRepository, AddressStore } from "../infra/address-repository";
import type { PixKeyRepository, PixKeyStore } from "../infra/pix-key-repository";
import type { AddressRow, PixKeyRow } from "../infra/schema";
import { updateAddress } from "./address-service";
import { updatePixKey } from "./pix-key-service";

// A linha some entre o find e o update (outra requisição excluiu): o serviço devolve null em vez de lançar.
const at = new Date("2026-01-01T00:00:00Z");

const addressRow: AddressRow = {
  id: "a",
  personId: "p",
  street: "Rua A",
  number: "1",
  complement: null,
  district: "Centro",
  city: "São Paulo",
  state: "SP",
  postalCode: "01001000",
  isPrimary: false,
  createdAt: at,
  updatedAt: at,
  version: 1,
};

const pixRow: PixKeyRow = {
  id: "k",
  ownerPersonId: "p",
  type: "EMAIL",
  value: "a@example.com",
  isPrimary: false,
  createdAt: at,
  updatedAt: at,
  version: 1,
};

describe("update when the row disappears before the write", () => {
  it("returns null for an address", async () => {
    // Só os membros que o caminho usa; o resto nunca é chamado.
    const store = {
      find: () => Promise.resolve(addressRow),
      clearPrimary: () => Promise.resolve(),
      update: () => Promise.resolve(null),
    } as unknown as AddressStore;
    const repository: AddressRepository = { inTransaction: (work) => work(store) };
    expect(await updateAddress(repository, "a", { street: "Rua B", isPrimary: true })).toBeNull();
  });

  it("returns null for a PIX key", async () => {
    const store = {
      find: () => Promise.resolve(pixRow),
      clearPrimary: () => Promise.resolve(),
      update: () => Promise.resolve(null),
    } as unknown as PixKeyStore;
    const repository: PixKeyRepository = { inTransaction: (work) => work(store) };
    expect(await updatePixKey(repository, "k", { value: "b@example.com", isPrimary: true })).toBeNull();
  });
});
