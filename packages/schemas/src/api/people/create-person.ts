import { z } from "zod";
import { cpfSchema, idSchema, isoDateSchema, phoneSchema } from "../../common";

/** POST /people (RFC-004, RF-01 e RF-03; limites de texto nas decisões do Joel de 17/11). */
export const createPersonRequest = z.strictObject({
  fullName: z.string().trim().min(1).max(150),
  cpf: cpfSchema,
  phone: phoneSchema,
  email: z.email().max(254).optional(),
  birthDate: isoDateSchema.optional(),
  referredById: idSchema.optional(),
  notes: z.string().trim().min(1).max(2000).optional(),
});
export type CreatePersonRequest = z.infer<typeof createPersonRequest>;

/** Pessoa resumida, item da lista (RF-04) e opção do "Indicado por" (RF-03). */
export const personSummarySchema = z.strictObject({
  id: idSchema,
  fullName: z.string().min(1),
  cpf: cpfSchema,
  phone: phoneSchema,
  active: z.boolean(),
});
export type PersonSummary = z.infer<typeof personSummarySchema>;

/** Resposta 200 de GET /people (RFC-004, RF-04): página com cursor. */
export const personListResponse = z.strictObject({
  items: z.array(personSummarySchema),
  nextCursor: z.string().nullable(),
});
export type PersonListResponse = z.infer<typeof personListResponse>;
