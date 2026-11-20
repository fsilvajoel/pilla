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

function revalidateAll(paths: readonly string[]): void {
  for (const path of paths) {
    if (path.includes("[id]")) revalidatePath(path, "page");
    else revalidatePath(path);
  }
}

/** Executa a mutação sem lançar: 4xx e fieldErrors voltam como resultado; em 404 a lista é revalidada. */
async function runMutation(paths: readonly string[], mutate: () => Promise<unknown>): Promise<PersonActionResult> {
  try {
    await mutate();
    revalidateAll(paths);
    return { ok: true, id: "" };
  } catch (error) {
    const result = toActionError(error);
    if (result.code === "NOT_FOUND") revalidateAll(paths);
    return result;
  }
}

export async function addAddressAction(personId: string, data: CreateAddressRequest): Promise<PersonActionResult> {
  return runMutation([`/pessoas/${personId}`], () => addAddress(personId, data));
}

export async function updateAddressAction(addressId: string, data: UpdateAddressRequest): Promise<PersonActionResult> {
  return runMutation(["/pessoas/[id]"], () => updateAddress(addressId, data));
}

export async function deleteAddressAction(addressId: string): Promise<PersonActionResult> {
  return runMutation(["/pessoas/[id]"], () => deleteAddress(addressId));
}

export async function addPixKeyAction(personId: string, data: CreatePixKeyRequest): Promise<PersonActionResult> {
  return runMutation([`/pessoas/${personId}`], () => addPixKey(personId, data));
}

export async function updatePixKeyAction(pixKeyId: string, data: UpdatePixKeyRequest): Promise<PersonActionResult> {
  return runMutation(["/pessoas/[id]"], () => updatePixKey(pixKeyId, data));
}

export async function deletePixKeyAction(pixKeyId: string): Promise<PersonActionResult> {
  return runMutation(["/pessoas/[id]"], () => deletePixKey(pixKeyId));
}

// A API troca o principal sozinha quando isPrimary=true.
export async function setPrimaryAddressAction(personId: string, addressId: string): Promise<PersonActionResult> {
  return runMutation([`/pessoas/${personId}`], () => updateAddress(addressId, { isPrimary: true }));
}

export async function setPrimaryPixKeyAction(personId: string, pixKeyId: string): Promise<PersonActionResult> {
  return runMutation([`/pessoas/${personId}`], () => updatePixKey(pixKeyId, { isPrimary: true }));
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
