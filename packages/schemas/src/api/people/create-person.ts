import { z } from "zod";
import { cpfSchema, idSchema, isoDateSchema, phoneSchema } from "../../common";

function unmask(value: string, maskChars: string): string {
  return Array.from(value)
    .filter((char) => !maskChars.includes(char))
    .join("");
}

/** Tira a máscara de `cpf` (pontos, traço, espaços) e de `phone` (espaços, parênteses, traço) antes de validar. */
export function normalizePersonMasks(input: unknown): unknown {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return input;
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => {
      if (typeof value !== "string") return [key, value];
      if (key === "cpf") return [key, unmask(value, ".- ")];
      return [key, key === "phone" ? unmask(value, " ()-") : value];
    }),
  );
}

/** Campos de criação da pessoa; base de `createPersonRequest` e de `updatePersonRequest`. */
export const personFields = z.strictObject({
  fullName: z.string().trim().min(1).max(150),
  cpf: cpfSchema,
  phone: phoneSchema,
  email: z.email().max(254).optional(),
  birthDate: isoDateSchema.optional(),
  referredById: idSchema.optional(),
  notes: z.string().trim().min(1).max(2000).optional(),
});
/** POST /people (RFC-004, RF-01 e RF-03; limites de texto nas decisões do Joel de 17/11). CPF e telefone aceitam máscara e viram só dígitos. */
export const createPersonRequest = z.preprocess(normalizePersonMasks, personFields);
export type CreatePersonRequest = z.infer<typeof createPersonRequest>;

/** Pessoa resumida, item da lista (RF-04) e opção do "Indicado por" (RF-03). */
export const personSummarySchema = z.strictObject({
  id: idSchema,
  fullName: z.string().min(1),
  /** null em pessoa importada sem CPF */
  cpf: cpfSchema.nullable(),
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
