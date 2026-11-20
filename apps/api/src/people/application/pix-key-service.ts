import { pixKeyTypeSchema, type CreatePixKeyRequest, type PixKey, type UpdatePixKeyRequest } from "@pilla/schemas";
import type { PixKeyChanges, PixKeyRepository } from "../infra/pix-key-repository";
import type { PixKeyRow } from "../infra/schema";

function toPixKey(row: PixKeyRow): PixKey {
  return { id: row.id, type: pixKeyType(row.type), value: row.value, isPrimary: row.isPrimary };
}

// A coluna é text com CHECK no banco; o schema Zod é a fonte do tipo.
function pixKeyType(value: string): PixKey["type"] {
  return pixKeyTypeSchema.parse(value);
}

function changesOf(input: UpdatePixKeyRequest): PixKeyChanges {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}

/** Cria a chave; a primeira da pessoa nasce principal e `isPrimary: true` troca a principal. `null`: pessoa inexistente. */
export async function createPixKey(
  repository: PixKeyRepository,
  personId: string,
  id: string,
  input: CreatePixKeyRequest,
): Promise<PixKey | null> {
  return repository.inTransaction(async (store) => {
    if (!(await store.personExists(personId))) return null;
    const isFirst = (await store.countByPerson(personId)) === 0;
    const isPrimary = isFirst || input.isPrimary === true;
    if (isPrimary) await store.clearPrimary(personId, null);
    const row = await store.insert({ id, ownerPersonId: personId, type: input.type, value: input.value, isPrimary });
    return toPixKey(row);
  });
}

/** Atualiza os campos enviados; `isPrimary: true` troca a principal e `false` não promove outra. `null`: inexistente. */
export async function updatePixKey(
  repository: PixKeyRepository,
  pixKeyId: string,
  input: UpdatePixKeyRequest,
): Promise<PixKey | null> {
  return repository.inTransaction(async (store) => {
    const current = await store.find(pixKeyId);
    if (current === null) return null;
    const changes = changesOf(input);
    if (Object.keys(changes).length === 0) return toPixKey(current);
    if (input.isPrimary === true) await store.clearPrimary(current.ownerPersonId, pixKeyId);
    const updated = await store.update(pixKeyId, changes);
    return updated === null ? null : toPixKey(updated);
  });
}

/** Exclui a chave sem promover outra a principal. `false`: inexistente. */
export function deletePixKey(repository: PixKeyRepository, pixKeyId: string): Promise<boolean> {
  return repository.inTransaction((store) => store.remove(pixKeyId));
}
