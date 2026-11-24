import { and, eq } from "drizzle-orm";
import type { Database } from "../../db/database";
import { adminUsers, sessions } from "./schema";

/** Sessão ADMIN com o administrador dono dela. */
export type AdminSessionView = {
  readonly lastSeenAt: Date;
  readonly expiresAt: Date;
  readonly adminUserId: string;
  readonly username: string;
  readonly active: boolean;
};

/** Instantes de validade de qualquer sessão, com o papel dela. */
export type SessionTimes = { readonly role: string; readonly lastSeenAt: Date; readonly expiresAt: Date };

export type NewAdminSessionRow = {
  readonly id: string;
  readonly adminUserId: string;
  readonly ip: string;
  readonly createdAt: Date;
  readonly expiresAt: Date;
};

// Acesso a `access.sessions`; os instantes vêm sempre do relógio da aplicação, nunca do now() do banco.
export function sessionRepository(db: Database) {
  return {
    async insertAdmin(row: NewAdminSessionRow): Promise<void> {
      await db.insert(sessions).values({ ...row, role: "ADMIN", lastSeenAt: row.createdAt });
    },
    async findAdmin(id: string): Promise<AdminSessionView | null> {
      const rows = await db
        .select({
          lastSeenAt: sessions.lastSeenAt,
          expiresAt: sessions.expiresAt,
          adminUserId: adminUsers.id,
          username: adminUsers.username,
          active: adminUsers.active,
        })
        .from(sessions)
        .innerJoin(adminUsers, eq(sessions.adminUserId, adminUsers.id))
        .where(and(eq(sessions.id, id), eq(sessions.role, "ADMIN")));
      return rows[0] ?? null;
    },
    async findTimes(id: string): Promise<SessionTimes | null> {
      const rows = await db
        .select({ role: sessions.role, lastSeenAt: sessions.lastSeenAt, expiresAt: sessions.expiresAt })
        .from(sessions)
        .where(eq(sessions.id, id));
      return rows[0] ?? null;
    },
    async touch(id: string, at: Date): Promise<void> {
      await db.update(sessions).set({ lastSeenAt: at }).where(eq(sessions.id, id));
    },
    async remove(id: string): Promise<void> {
      await db.delete(sessions).where(eq(sessions.id, id));
    },
  };
}
