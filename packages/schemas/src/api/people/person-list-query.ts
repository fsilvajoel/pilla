import { z } from "zod";

/**
 * GET /people (RFC-004, RF-04): query string. `search` é texto livre (nome sem distinguir acento e maiúsculas, ou CPF por
 * prefixo, com ou sem máscara; busca com letra e dígito vale só como nome); quem interpreta é a API. `limit` vem como texto
 * na URL: padrão 20, de 1 a 100. `cursor` é o `nextCursor` da página anterior.
 */
export const personListQuery = z.strictObject({
  search: z.string().trim().max(100).optional(),
  limit: z
    .string()
    .max(3)
    .refine((text) => text !== "" && Array.from(text).every((char) => "0123456789".includes(char)))
    .transform((text) => Number(text))
    .pipe(z.int().min(1).max(100))
    .default(20),
  cursor: z.string().min(1).max(500).optional(),
});
export type PersonListQuery = z.infer<typeof personListQuery>;
