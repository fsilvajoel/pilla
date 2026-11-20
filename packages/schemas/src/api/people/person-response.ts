import { z } from "zod";

export type PersonResponse = {
  id: string;
  fullName: string;
  cpf: string;
  phone: string;
  email?: string;
  birthDate?: string;
  notes?: string;
  active: boolean;
  version: number;
};

// Esboço (E9-F03): contrato ainda não implementado.
export const personResponse = z.custom<PersonResponse>(() => {
  throw new Error("esboço: não implementado");
});
