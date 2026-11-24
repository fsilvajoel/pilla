import { asc, eq } from "drizzle-orm";
import type { Database } from "../../db/database";
import { adminUsers } from "./schema";

/** Dados do administrador que o login precisa; o hash nunca sai da camada de aplicação. */
export type AdminCredentials = {
  readonly id: string;
  readonly username: string;
  readonly passwordHash: string;
  readonly active: boolean;
};

export function adminUserRepository(db: Database) {
  return {
    async findByUsername(username: string): Promise<AdminCredentials | null> {
      const rows = await db
        .select({
          id: adminUsers.id,
          username: adminUsers.username,
          passwordHash: adminUsers.passwordHash,
          active: adminUsers.active,
        })
        .from(adminUsers)
        .where(eq(adminUsers.username, username));
      return rows[0] ?? null;
    },
    /** Primeiro administrador ativo (usuário mais antigo); só para o modo sem autenticação de desenvolvimento. */
    async findFirstActive(): Promise<{ readonly id: string; readonly username: string } | null> {
      const rows = await db
        .select({ id: adminUsers.id, username: adminUsers.username })
        .from(adminUsers)
        .where(eq(adminUsers.active, true))
        .orderBy(asc(adminUsers.createdAt), asc(adminUsers.username))
        .limit(1);
      return rows[0] ?? null;
    },
    async setLastLogin(id: string, at: Date): Promise<void> {
      await db.update(adminUsers).set({ lastLoginAt: at }).where(eq(adminUsers.id, id));
    },
  };
}
