"use server";

import { revalidatePath } from "next/cache";
import { createPerson, listPeople, updatePerson } from "@/lib/api/people";
import { checkCreateRequest, checkUpdateRequest } from "@/components/people/person-form-request";
import { toActionError, type PersonActionResult } from "@/lib/people-action-result";
import type { PersonSummary } from "@pilla/schemas";

function invalid(fieldErrors: Readonly<Record<string, string>>): PersonActionResult {
  return { ok: false, code: "VALIDATION_FAILED", message: "Confira os campos do cadastro.", fieldErrors };
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
