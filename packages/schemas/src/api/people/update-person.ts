import { z } from "zod";

export type UpdatePersonRequest = {
  version: number;
  fullName?: string;
  cpf?: string;
  phone?: string;
  email?: string | null;
  birthDate?: string | null;
  notes?: string | null;
};

// Esboço (E9-F03): contrato ainda não implementado.
export const updatePersonRequest = z.custom<UpdatePersonRequest>(() => {
  throw new Error("esboço: não implementado");
});
