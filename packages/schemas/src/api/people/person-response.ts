import { z } from "zod";
import { cpfSchema, idSchema, isoDateSchema, phoneSchema } from "../../common";

/** Resposta de POST/GET/PATCH de /people (RFC-004, RF-01): dados básicos da pessoa, sem agregados; opcionais nulos são omitidos. */
export const personResponse = z.strictObject({
  id: idSchema,
  fullName: z.string().min(1),
  cpf: cpfSchema.nullable(),
  phone: phoneSchema,
  email: z.email().optional(),
  birthDate: isoDateSchema.optional(),
  notes: z.string().optional(),
  active: z.boolean(),
  version: z.int().nonnegative(),
});
export type PersonResponse = z.infer<typeof personResponse>;
