import type { AdminMeResponse } from "@pilla/schemas";
import type { Database } from "../../db/database";
import { newSessionToken, sessionIdOf } from "../domain/session-token";
import { sessionRepository } from "../infra/session-repository";

// Validade da sessão (E14 D3, pendência de PM E14-T03): constantes no código, sem variável de ambiente.
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
/** Inatividade máxima desde `last_seen_at`. */
export const SESSION_IDLE_MS = 2 * HOUR_MS;
/** Teto absoluto desde a criação, gravado em `expires_at`. */
export const SESSION_ABSOLUTE_MS = 12 * HOUR_MS;
/** `last_seen_at` só é regravado quando está mais velho que isto. */
export const SESSION_TOUCH_MS = MINUTE_MS;

/** Sessão recém-criada: o token vai só no cookie; a linha guarda o hash (E14 D3). */
export type NewAdminSession = { readonly token: string; readonly expiresAt: Date };

/** Cria a sessão ADMIN no relógio da aplicação; grava só o SHA-256 do token. */
export async function createAdminSession(db: Database, adminUserId: string, ip: string): Promise<NewAdminSession> {
  const token = newSessionToken();
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + SESSION_ABSOLUTE_MS);
  await sessionRepository(db).insertAdmin({ id: sessionIdOf(token), adminUserId, ip, createdAt, expiresAt });
  return { token, expiresAt };
}

/** Admin da sessão viva, ou `null` (ausente, vencida ou admin inativo). Sessão morta é apagada ao aparecer. */
export async function resolveAdminSession(db: Database, token: string): Promise<AdminMeResponse | null> {
  const repository = sessionRepository(db);
  const id = sessionIdOf(token);
  const session = await repository.findAdmin(id);
  if (session === null) return null;
  const now = new Date();
  const idleMs = now.getTime() - session.lastSeenAt.getTime();
  if (!session.active || idleMs > SESSION_IDLE_MS || now.getTime() >= session.expiresAt.getTime()) {
    await repository.remove(id);
    return null;
  }
  if (idleMs > SESSION_TOUCH_MS) await repository.touch(id, now);
  return { id: session.adminUserId, username: session.username, role: "ADMIN" };
}

/** Sessão viva do token: ADMIN com o administrador, ou só o papel CLIENT (o portal ainda não tem rotas). */
export type ResolvedSession = { readonly role: "ADMIN"; readonly admin: AdminMeResponse } | { readonly role: "CLIENT" };

/** Sessão viva de qualquer papel, ou `null` (ausente ou vencida); a ADMIN segue as regras de `resolveAdminSession`. */
export async function resolveSession(db: Database, token: string): Promise<ResolvedSession | null> {
  const admin = await resolveAdminSession(db, token);
  if (admin !== null) return { role: "ADMIN", admin };
  const times = await sessionRepository(db).findTimes(sessionIdOf(token));
  if (times?.role !== "CLIENT") return null;
  const now = Date.now();
  const alive = now - times.lastSeenAt.getTime() <= SESSION_IDLE_MS && now < times.expiresAt.getTime();
  return alive ? { role: "CLIENT" } : null;
}

/** Apaga a sessão do token, se existir. */
export async function endSession(db: Database, token: string): Promise<void> {
  await sessionRepository(db).remove(sessionIdOf(token));
}
