import type { Database } from "../../db/database";

export type SeedAdminInput = { readonly username: string; readonly password: string };

/** Cria o admin ou troca a senha do existente (E14 D9). Esboço: a implementação é E14-T10. */
export function seedAdmin(_db: Database, _input: SeedAdminInput): Promise<"created" | "updated"> {
  return Promise.reject(new Error("esboço: não implementado"));
}
