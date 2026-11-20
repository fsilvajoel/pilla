import {
  createPersonRequest,
  updatePersonRequest,
  type CreatePersonRequest,
  type UpdatePersonRequest,
} from "@pilla/schemas";

/** Campos como o ADMIN digita; texto vazio = campo opcional ausente. Máscaras de CPF e telefone são só de exibição. */
export interface PersonFormValues {
  readonly fullName: string;
  readonly cpf: string;
  readonly phone: string;
  readonly email: string;
  readonly birthDate: string;
  readonly referredById: string;
  readonly notes: string;
}

export const emptyPersonFormValues: PersonFormValues = {
  fullName: "",
  cpf: "",
  phone: "",
  email: "",
  birthDate: "",
  referredById: "",
  notes: "",
};

export type RequestCheck<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly fieldErrors: Readonly<Record<string, string>> };

function fieldErrorsOf(issues: readonly { path: readonly PropertyKey[]; message: string }[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of issues) {
    const field = issue.path[0];
    const key = typeof field === "string" ? field : "form";
    result[key] ??= issue.message;
  }
  return result;
}

/** Corpo bruto de POST /people: opcionais vazios ficam de fora. */
export function toCreateBody(values: PersonFormValues): Record<string, string> {
  const body: Record<string, string> = { fullName: values.fullName, cpf: values.cpf, phone: values.phone };
  if (values.email !== "") body.email = values.email;
  if (values.birthDate !== "") body.birthDate = values.birthDate;
  if (values.referredById !== "") body.referredById = values.referredById;
  if (values.notes !== "") body.notes = values.notes;
  return body;
}

/** Corpo bruto de PATCH /people/{id}: opcionais vazios viram null (limpam a coluna); indicador não muda. */
export function toUpdateBody(values: PersonFormValues, version: number): Record<string, string | number | null> {
  return {
    fullName: values.fullName,
    cpf: values.cpf,
    phone: values.phone,
    email: values.email === "" ? null : values.email,
    birthDate: values.birthDate === "" ? null : values.birthDate,
    notes: values.notes === "" ? null : values.notes,
    version,
  };
}

/** Valida o corpo de criação com o schema da API (nenhuma regra copiada para o web). */
export function checkCreateRequest(input: unknown): RequestCheck<CreatePersonRequest> {
  const parsed = createPersonRequest.safeParse(input);
  return parsed.success
    ? { ok: true, data: parsed.data }
    : { ok: false, fieldErrors: fieldErrorsOf(parsed.error.issues) };
}

/** Valida o corpo de edição com o schema da API. */
export function checkUpdateRequest(input: unknown): RequestCheck<UpdatePersonRequest> {
  const parsed = updatePersonRequest.safeParse(input);
  return parsed.success
    ? { ok: true, data: parsed.data }
    : { ok: false, fieldErrors: fieldErrorsOf(parsed.error.issues) };
}
