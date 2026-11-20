import { z } from "zod";
import { normalizePersonMasks, personFields } from "./create-person";

/**
 * PATCH /people/{id} (RFC-004, RF-01): campos de criação parciais + `version` (controle otimista, VERSION_CONFLICT).
 * `null` em email, birthDate e notes limpa a coluna; cpf não aceita null; indicador (referredById) não muda por aqui.
 */
export const updatePersonRequest = z.preprocess(
  normalizePersonMasks,
  personFields.omit({ referredById: true }).partial().extend({
    email: personFields.shape.email.nullable().optional(),
    birthDate: personFields.shape.birthDate.nullable().optional(),
    notes: personFields.shape.notes.nullable().optional(),
    version: z.int().nonnegative(),
  }),
);
export type UpdatePersonRequest = z.infer<typeof updatePersonRequest>;
