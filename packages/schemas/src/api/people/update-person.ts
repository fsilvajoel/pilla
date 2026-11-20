import { z } from "zod";
import { createPersonRequest } from "./create-person";

/**
 * PATCH /people/{id} (RFC-004, RF-01): campos de criação parciais + `version` (controle otimista, VERSION_CONFLICT).
 * Campo omitido = intocado; os campos opcionais aceitam `null` para limpar o valor.
 */
const { email, birthDate, referredById, notes } = createPersonRequest.shape;
export const updatePersonRequest = createPersonRequest.partial().extend({
  email: email.unwrap().nullable().optional(),
  birthDate: birthDate.unwrap().nullable().optional(),
  referredById: referredById.unwrap().nullable().optional(),
  notes: notes.unwrap().nullable().optional(),
  version: z.int().nonnegative(),
});
export type UpdatePersonRequest = z.infer<typeof updatePersonRequest>;
