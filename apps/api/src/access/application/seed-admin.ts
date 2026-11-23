import { sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { newId } from "../../core/public/ids";
import { hashPassword } from "../domain/password";
import { adminUsers } from "../infra/schema";

export type SeedAdminInput = { readonly username: string; readonly password: string };

const USERNAME_MAX = 100;
const PASSWORD_MIN = 12;
const PASSWORD_MAX = 200;

// Conta caracteres como pontos de código (acentos e emojis contam uma vez).
const lengthOf = (text: string): number => Array.from(text).length;

/**
 * Cria o primeiro admin ou troca a senha do existente (E14 D9, PRD-001 RN-A05).
 * Nome existente: troca o hash, reativa, sobe `version` e mantém o id. Num único INSERT ... ON CONFLICT,
 * então não há corrida entre duas execuções. A mensagem de erro nunca contém a senha.
 */
export async function seedAdmin(
  db: PgDatabase<PgQueryResultHKT>,
  input: SeedAdminInput,
): Promise<"created" | "updated"> {
  const username = input.username.trim();
  if (lengthOf(username) < 1 || lengthOf(username) > USERNAME_MAX) {
    throw new Error(`o nome de usuário deve ter de 1 a ${String(USERNAME_MAX)} caracteres`);
  }
  const length = lengthOf(input.password);
  if (length < PASSWORD_MIN || length > PASSWORD_MAX) {
    throw new Error(`a senha deve ter de ${String(PASSWORD_MIN)} a ${String(PASSWORD_MAX)} caracteres`);
  }

  const passwordHash = await hashPassword(input.password);
  const [row] = await db
    .insert(adminUsers)
    .values({ id: newId(), username, passwordHash, active: true, version: 1 })
    .onConflictDoUpdate({
      target: adminUsers.username,
      set: {
        passwordHash,
        active: true,
        version: sql`${adminUsers.version} + 1`,
        updatedAt: new Date(),
      },
    })
    .returning({ version: adminUsers.version });

  // Linha nova nasce com version 1; qualquer conflito a incrementa, então version 1 significa criação.
  return row?.version === 1 ? "created" : "updated";
}
