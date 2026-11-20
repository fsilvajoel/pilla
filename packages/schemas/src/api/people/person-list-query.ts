import { z } from "zod";

export type PersonListQuery = { search: string; limit: number; cursor?: string | null };

// Esboço (E9-F03): contrato ainda não implementado.
export const personListQuery = z.custom<PersonListQuery>(() => {
  throw new Error("esboço: não implementado");
});
