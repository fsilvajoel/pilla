import type { Address, CreateAddressRequest, UpdateAddressRequest } from "@pilla/schemas";
import type { AddressChanges, AddressRepository } from "../infra/address-repository";
import type { AddressRow } from "../infra/schema";

function toAddress(row: AddressRow): Address {
  return {
    id: row.id,
    street: row.street,
    number: row.number,
    ...(row.complement === null ? {} : { complement: row.complement }),
    district: row.district,
    city: row.city,
    state: row.state,
    postalCode: row.postalCode,
    isPrimary: row.isPrimary,
  };
}

function changesOf(input: UpdateAddressRequest): AddressChanges {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}

/** Cria o endereço; o primeiro da pessoa nasce principal e `isPrimary: true` troca o principal. `null`: pessoa inexistente. */
export async function createAddress(
  repository: AddressRepository,
  personId: string,
  id: string,
  input: CreateAddressRequest,
): Promise<Address | null> {
  return repository.inTransaction(async (store) => {
    if (!(await store.personExists(personId))) return null;
    const isFirst = (await store.countByPerson(personId)) === 0;
    const isPrimary = isFirst || input.isPrimary === true;
    if (isPrimary) await store.clearPrimary(personId, null);
    const row = await store.insert({
      id,
      personId,
      street: input.street,
      number: input.number,
      ...(input.complement === undefined ? {} : { complement: input.complement }),
      district: input.district,
      city: input.city,
      state: input.state,
      postalCode: input.postalCode,
      isPrimary,
    });
    return toAddress(row);
  });
}

/** Atualiza os campos enviados; `isPrimary: true` troca o principal e `false` não promove outro. `null`: inexistente. */
export async function updateAddress(
  repository: AddressRepository,
  addressId: string,
  input: UpdateAddressRequest,
): Promise<Address | null> {
  return repository.inTransaction(async (store) => {
    const current = await store.find(addressId);
    if (current === null) return null;
    const changes = changesOf(input);
    if (Object.keys(changes).length === 0) return toAddress(current);
    if (input.isPrimary === true) await store.clearPrimary(current.personId, addressId);
    const updated = await store.update(addressId, changes);
    return updated === null ? null : toAddress(updated);
  });
}

/** Exclui o endereço sem promover outro a principal. `false`: inexistente. */
export function deleteAddress(repository: AddressRepository, addressId: string): Promise<boolean> {
  return repository.inTransaction((store) => store.remove(addressId));
}
