import { z } from "zod";
import { normalizePersonMasks, personFields } from "./create-person";

/** PATCH /people/{id} (RFC-004, RF-01): campos de criação parciais + `version` (controle otimista, VERSION_CONFLICT). */
export const updatePersonRequest = z.preprocess(
  normalizePersonMasks,
  personFields.partial().extend({ version: z.int().nonnegative() }),
);
export type UpdatePersonRequest = z.infer<typeof updatePersonRequest>;
