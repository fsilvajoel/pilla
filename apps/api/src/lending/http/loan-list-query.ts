import { idSchema, loanStandingSchema, loanStatusSchema } from "@pilla/schemas";
import { z } from "zod";

/** GET /loans: filtros e paginação por cursor. `limit` vem como texto na URL: padrão 20, de 1 a 100. */
export const loanListQuery = z.strictObject({
  personId: idSchema.optional(),
  status: loanStatusSchema.optional(),
  standing: loanStandingSchema.optional(),
  limit: z
    .string()
    .max(3)
    .refine((text) => text !== "" && Array.from(text).every((char) => "0123456789".includes(char)))
    .transform((text) => Number(text))
    .pipe(z.int().min(1).max(100))
    .default(20),
  cursor: z.string().min(1).max(100).optional(),
});
export type LoanListQuery = z.infer<typeof loanListQuery>;
