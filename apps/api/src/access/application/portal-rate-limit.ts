import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { portalRepository } from "../infra/portal-repository";
import { PORTAL_ATTEMPT_LIMIT, PORTAL_ATTEMPT_WINDOW_MS, PORTAL_SECOND_MS } from "./portal-policy";

export type Admission = { readonly admitted: true } | { readonly admitted: false; readonly retryAfterSeconds: number };

/**
 * Limite por IP (RN-A04, CA-09b, E15 D4): janela deslizante sobre `access_logs`, sem as linhas RATE_LIMITED. Roda
 * dentro da transação da entrada: a trava por IP segura o limite contra pedidos paralelos.
 */
export async function admitAttempt(db: PgDatabase<PgQueryResultHKT>, ip: string, now: Date): Promise<Admission> {
  await portalRepository.lockIp(db, ip);
  const times = await portalRepository.attemptTimes(db, ip, new Date(now.getTime() - PORTAL_ATTEMPT_WINDOW_MS));
  if (times.length < PORTAL_ATTEMPT_LIMIT) return { admitted: true };
  const oldest = Math.min(...times.map((time) => time.getTime()));
  const leavesInMs = oldest + PORTAL_ATTEMPT_WINDOW_MS - now.getTime();
  return { admitted: false, retryAfterSeconds: Math.max(1, Math.ceil(leavesInMs / PORTAL_SECOND_MS)) };
}
