import { and, asc, eq, gt, lte, ne, or, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { accessLogs, portalAccess, sessions } from "./schema";

type Db = PgDatabase<PgQueryResultHKT>;

export type AccessResult = "OK" | "NOT_FOUND" | "DISABLED" | "RATE_LIMITED";

/** Sessão CLIENT com o estado atual do acesso da pessoa ao portal (sem linha em `portal_access` não há sessão válida). */
export type ClientSessionView = {
  readonly personId: string;
  readonly lastSeenAt: Date;
  readonly expiresAt: Date;
  readonly enabled: boolean;
};

// Acesso do portal a `access.access_logs`, `access.portal_access` e às sessões CLIENT; os instantes vêm sempre
// do relógio da aplicação (E15 D4, D6).
export const portalRepository = {
  /** Instantes das tentativas contadas do IP na janela (tudo menos RATE_LIMITED), da mais antiga à mais nova. */
  async attemptTimes(db: Db, ip: string, since: Date): Promise<Date[]> {
    const rows = await db
      .select({ at: accessLogs.at })
      .from(accessLogs)
      .where(and(eq(accessLogs.ip, ip), gt(accessLogs.at, since), ne(accessLogs.result, "RATE_LIMITED")))
      .orderBy(asc(accessLogs.at));
    return rows.map((row) => row.at);
  },
  /** Trava por IP até o fim da transação (E15 D4): a contagem e o insert não correm em paralelo. */
  async lockIp(db: Db, ip: string): Promise<void> {
    await db.execute(sql`select pg_advisory_xact_lock(hashtext(${ip}))`);
  },
  async insertLog(
    db: Db,
    row: { id: string; at: Date; ip: string; cpfHash: string; result: AccessResult },
  ): Promise<void> {
    await db.insert(accessLogs).values(row);
  },
  /** Estado do acesso da pessoa: `null` quando não há linha em `portal_access`. */
  async accessState(db: Db, personId: string): Promise<boolean | null> {
    const rows = await db
      .select({ enabled: portalAccess.enabled })
      .from(portalAccess)
      .where(eq(portalAccess.personId, personId));
    return rows[0]?.enabled ?? null;
  },
  /** Apaga as sessões CLIENT da pessoa vencidas pelo teto ou paradas há mais que `idleSince`. */
  async deleteStale(db: Db, personId: string, now: Date, idleSince: Date): Promise<void> {
    await db
      .delete(sessions)
      .where(
        and(
          eq(sessions.role, "CLIENT"),
          eq(sessions.personId, personId),
          or(lte(sessions.expiresAt, now), lte(sessions.lastSeenAt, idleSince)),
        ),
      );
  },
  async insertSession(
    db: Db,
    row: { id: string; personId: string; ip: string; createdAt: Date; expiresAt: Date },
  ): Promise<void> {
    await db.insert(sessions).values({ ...row, role: "CLIENT", lastSeenAt: row.createdAt });
  },
  async findSession(db: Db, id: string): Promise<ClientSessionView | null> {
    const rows = await db
      .select({
        personId: portalAccess.personId,
        lastSeenAt: sessions.lastSeenAt,
        expiresAt: sessions.expiresAt,
        enabled: portalAccess.enabled,
      })
      .from(sessions)
      .innerJoin(portalAccess, eq(portalAccess.personId, sessions.personId))
      .where(and(eq(sessions.id, id), eq(sessions.role, "CLIENT")));
    return rows[0] ?? null;
  },
  async touch(db: Db, id: string, at: Date): Promise<void> {
    await db.update(sessions).set({ lastSeenAt: at }).where(eq(sessions.id, id));
  },
  /** Apaga só sessão CLIENT: o portal nunca encerra sessão de ADMIN. */
  async remove(db: Db, id: string): Promise<void> {
    await db.delete(sessions).where(and(eq(sessions.id, id), eq(sessions.role, "CLIENT")));
  },
};
