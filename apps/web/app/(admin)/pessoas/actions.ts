"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createPersonRequest, updatePersonRequest, type PersonSummary } from "@pilla/schemas";
import { createPerson, listPeople, updatePerson } from "@/lib/api/people";
import { ApiProblem } from "@/lib/api/problem";

/** Dados já normalizados pelo formulário (CPF só dígitos, telefone E.164, data ISO). Campos vazios são omitidos. */
export interface PersonPayload {
  fullName: string;
  cpf: string;
  phone: string;
  email?: string;
  birthDate?: string;
  referredById?: string;
  notes?: string;
}

/**
 * Corpo do PATCH: campo omitido = intocado; `null` = limpar o campo opcional.
 * Sem `referredById`: pela decisão do Joel (20/11) a indicação é fixa depois do cadastro.
 */
export interface PersonUpdatePayload {
  fullName?: string;
  cpf?: string;
  phone?: string;
  email?: string | null;
  birthDate?: string | null;
  notes?: string | null;
}

export interface PersonActionFailure {
  ok: false;
  message: string;
  fieldErrors: Record<string, string>;
}

const VERSION_CONFLICT_MESSAGE = "Esta ficha foi alterada por outra pessoa. Recarregue a página e tente novamente.";

const DUPLICATE_CPF_MESSAGE = "CPF já cadastrado";

function failure(message: string, fieldErrors: Record<string, string> = {}): PersonActionFailure {
  return { ok: false, message, fieldErrors };
}

function fromError(error: unknown): PersonActionFailure {
  if (error instanceof ApiProblem) {
    if (error.code === "VERSION_CONFLICT") return failure(VERSION_CONFLICT_MESSAGE);
    if (error.code === "DUPLICATE_CPF") return failure(DUPLICATE_CPF_MESSAGE, { cpf: DUPLICATE_CPF_MESSAGE });
    return failure(error.message, error.fieldMessages());
  }
  return failure("Erro inesperado. Tente novamente.");
}

/** Cria a pessoa e vai para a ficha. Só devolve em caso de erro. */
export async function createPersonAction(payload: PersonPayload): Promise<PersonActionFailure> {
  const parsed = createPersonRequest.safeParse(payload);
  if (!parsed.success) return failure("Confira os campos do formulário.");
  let id: string;
  try {
    id = (await createPerson(parsed.data)).id;
  } catch (error) {
    return fromError(error);
  }
  revalidatePath("/pessoas");
  redirect(`/pessoas/${id}`);
}

/** Atualiza a pessoa (com `version`, controle otimista) e vai para a ficha. Só devolve em caso de erro. */
export async function updatePersonAction(
  personId: string,
  version: number,
  payload: PersonUpdatePayload,
): Promise<PersonActionFailure> {
  const parsed = updatePersonRequest.safeParse({ ...payload, version });
  if (!parsed.success) return failure("Confira os campos do formulário.");
  try {
    await updatePerson(personId, parsed.data);
  } catch (error) {
    return fromError(error);
  }
  revalidatePath("/pessoas");
  revalidatePath(`/pessoas/${personId}`);
  redirect(`/pessoas/${personId}`);
}

/** Busca de "Indicado por" (nome ou CPF). Erros viram lista vazia. */
export async function searchReferrersAction(query: string): Promise<PersonSummary[]> {
  const search = query.trim();
  if (search.length < 2) return [];
  try {
    return (await listPeople({ search, limit: 8 })).items;
  } catch {
    return [];
  }
}
