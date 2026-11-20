"use server";

import { revalidatePath } from "next/cache";
import {
  addAddress,
  updateAddress,
  deleteAddress,
  addPixKey,
  updatePixKey,
  deletePixKey,
  createPerson,
  listPeople,
  updatePerson,
} from "@/lib/api/people";
import { checkCreateRequest, checkUpdateRequest } from "@/components/people/person-form-request";
import { toActionError, type PersonActionResult } from "@/lib/people-action-result";

function invalid(fieldErrors: Readonly<Record<string, string>>): PersonActionResult {
  return { ok: false, code: "VALIDATION_FAILED", message: "Confira os campos do cadastro.", fieldErrors };
}

import type {
  CreateAddressRequest,
  UpdateAddressRequest,
  CreatePixKeyRequest,
  UpdatePixKeyRequest,
  PersonSummary,
} from "@pilla/schemas";

export async function addAddressAction(personId: string, data: CreateAddressRequest): Promise<void> {
  await addAddress(personId, data);
  revalidatePath(`/pessoas/${personId}`);
}

export async function updateAddressAction(addressId: string, data: UpdateAddressRequest): Promise<void> {
  await updateAddress(addressId, data);
  revalidatePath("/pessoas/[id]", "page");
}

export async function deleteAddressAction(addressId: string): Promise<void> {
  await deleteAddress(addressId);
  revalidatePath("/pessoas/[id]", "page");
}

export async function addPixKeyAction(personId: string, data: CreatePixKeyRequest): Promise<void> {
  await addPixKey(personId, data);
  revalidatePath(`/pessoas/${personId}`);
}

export async function updatePixKeyAction(pixKeyId: string, data: UpdatePixKeyRequest): Promise<void> {
  await updatePixKey(pixKeyId, data);
  revalidatePath("/pessoas/[id]", "page");
}

export async function deletePixKeyAction(pixKeyId: string): Promise<void> {
  await deletePixKey(pixKeyId);
  revalidatePath("/pessoas/[id]", "page");
}

// The API handles primary swap automatically when isPrimary=true is sent
// So we just call update with isPrimary=true
export async function setPrimaryAddressAction(personId: string, addressId: string): Promise<void> {
  await updateAddress(addressId, { isPrimary: true });
  revalidatePath(`/pessoas/${personId}`);
}

export async function setPrimaryPixKeyAction(personId: string, pixKeyId: string): Promise<void> {
  await updatePixKey(pixKeyId, { isPrimary: true });
  revalidatePath(`/pessoas/${personId}`);
}

/** Cria a pessoa (RF-01, RF-03). A entrada é revalidada aqui com o schema da API. */
export async function createPersonAction(input: unknown): Promise<PersonActionResult> {
  const check = checkCreateRequest(input);
  if (!check.ok) return invalid(check.fieldErrors);
  try {
    const person = await createPerson(check.data);
    revalidatePath("/pessoas");
    return { ok: true, id: person.id };
  } catch (error) {
    return toActionError(error);
  }
}

/** Edita a pessoa com controle de versão (VERSION_CONFLICT em 409). */
export async function updatePersonAction(id: string, input: unknown): Promise<PersonActionResult> {
  const check = checkUpdateRequest(input);
  if (!check.ok) return invalid(check.fieldErrors);
  try {
    const person = await updatePerson(id, check.data);
    revalidatePath("/pessoas");
    revalidatePath(`/pessoas/${id}`);
    return { ok: true, id: person.id };
  } catch (error) {
    return toActionError(error);
  }
}

/** Busca pessoas por nome ou CPF para escolher o indicador; falha vira lista vazia. */
export async function searchPeopleAction(term: string): Promise<readonly PersonSummary[]> {
  const search = term.trim();
  if (search.length < 2) return [];
  try {
    const { items } = await listPeople({ search, limit: 8 });
    return items;
  } catch {
    return [];
  }
}
