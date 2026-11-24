import { and, eq, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { portalAccess, sessions, type PortalAccessRow } from "./schema";

type Db = PgDatabase<PgQueryResultHKT>;

// Escrita de `access.portal_access` pelo ADMIN (E15 D13); os instantes vêm do relógio da aplicação.
export const portalAccessRepository = {
  async find(db: Db, personId: string): Promise<PortalAccessRow | null> {
    const rows = await db.select().from(portalAccess).where(eq(portalAccess.personId, personId));
    return rows[0] ?? null;
  },
  /** Habilita: cria a linha ou a religa, com novo `enabled_at` e `enabled_by`; a versão sobe só se a linha existia. */
  async enable(db: Db, personId: string, adminUserId: string, at: Date): Promise<void> {
    await db
      .insert(portalAccess)
      .values({ personId, enabled: true, enabledAt: at, enabledBy: adminUserId, createdAt: at, updatedAt: at })
      .onConflictDoUpdate({
        target: portalAccess.personId,
        set: {
          enabled: true,
          enabledAt: at,
          enabledBy: adminUserId,
          updatedAt: at,
          version: sql`${portalAccess.version} + 1`,
        },
      });
  },
  /** Desabilita: mantém `enabled_at` e `enabled_by`. */
  async disable(db: Db, personId: string, at: Date): Promise<void> {
    await db
      .update(portalAccess)
      .set({ enabled: false, updatedAt: at, version: sql`${portalAccess.version} + 1` })
      .where(eq(portalAccess.personId, personId));
  },
  /** Apaga as sessões CLIENT da pessoa: o acesso cai na hora (E15 D7). */
  async deleteClientSessions(db: Db, personId: string): Promise<void> {
    await db.delete(sessions).where(and(eq(sessions.role, "CLIENT"), eq(sessions.personId, personId)));
  },
};
