import { z } from "zod";
import { createPersonRequest } from "./create-person";

/** PATCH /people/{id} (RFC-004, RF-01): campos de criação parciais + `version` (controle otimista, VERSION_CONFLICT). */
export const updatePersonRequest = createPersonRequest.partial().extend({ version: z.int().nonnegative() });
export type UpdatePersonRequest = z.infer<typeof updatePersonRequest>;
