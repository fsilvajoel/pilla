import { createPortalSessionRequest } from "@pilla/schemas";
import { z } from "zod";
import { newId } from "../../core/public/ids";
import type { Database } from "../../db/database";
import { findPersonIdByCpf } from "../../people/public/person-by-cpf";
import { hashCpf } from "../domain/cpf-hash";
import { newSessionToken, sessionIdOf } from "../domain/session-token";
import { portalRepository, type AccessResult } from "../infra/portal-repository";
import { PORTAL_SESSION_ABSOLUTE_MS, PORTAL_SESSION_IDLE_MS } from "./portal-policy";
import { admitAttempt } from "./portal-rate-limit";

// UUID que nunca existe: a consulta de acesso roda mesmo sem pessoa, para o fluxo ser o mesmo em todos os casos (E15 D3).
const NO_PERSON = "00000000-0000-0000-0000-000000000000";

export type EntryInput = {
  /** Corpo como veio: a validação roda dentro da transação, depois do limite (E15 D3). */
  readonly body: unknown;
  readonly ip: string;
  readonly hashKey: string;
  readonly now?: Date;
};

export type EntryOutcome =
  | { readonly kind: "OK"; readonly token: string; readonly expiresAt: Date }
  | { readonly kind: "DENIED" }
  | { readonly kind: "INVALID" }
  | { readonly kind: "RATE_LIMITED"; readonly retryAfterSeconds: number };

const typedCpf = z.looseObject({ cpf: z.string() });

/** Entrada por CPF (RN-A04, E15 D3, D4, D6): o mesmo trabalho em todos os casos, e o log antes de decidir. */
export function enterPortal(db: Database, input: EntryInput): Promise<EntryOutcome> {
  const { body, ip, hashKey, now = new Date() } = input;
  const typed = typedCpf.safeParse(body);
  const cpfHash = hashCpf(typed.success ? typed.data.cpf : "", hashKey);
  const log = (tx: Parameters<typeof admitAttempt>[0], result: AccessResult): Promise<void> =>
    portalRepository.insertLog(tx, { id: newId(), at: now, ip, cpfHash, result });

  return db.transaction(async (tx) => {
    const admission = await admitAttempt(tx, ip, now);
    if (!admission.admitted) {
      await log(tx, "RATE_LIMITED");
      return { kind: "RATE_LIMITED", retryAfterSeconds: admission.retryAfterSeconds };
    }
    const request = createPortalSessionRequest.safeParse(body);
    if (!request.success) {
      await log(tx, "NOT_FOUND");
      return { kind: "INVALID" };
    }
    const personId = await findPersonIdByCpf(tx, request.data.cpf);
    const enabled = await portalRepository.accessState(tx, personId ?? NO_PERSON);
    if (personId === null || enabled !== true) {
      await log(tx, enabled === false ? "DISABLED" : "NOT_FOUND");
      return { kind: "DENIED" };
    }
    await log(tx, "OK");
    await portalRepository.deleteStale(tx, personId, now, new Date(now.getTime() - PORTAL_SESSION_IDLE_MS));
    const token = newSessionToken();
    const expiresAt = new Date(now.getTime() + PORTAL_SESSION_ABSOLUTE_MS);
    await portalRepository.insertSession(tx, { id: sessionIdOf(token), personId, ip, createdAt: now, expiresAt });
    return { kind: "OK", token, expiresAt };
  });
}

/** Pessoa da sessão viva do cliente, ou `null`; reconfere o acesso e renova `last_seen_at` (E15 D6, D7). */
export async function resolvePortalPerson(db: Database, token: string, now = new Date()): Promise<string | null> {
  const id = sessionIdOf(token);
  const session = await portalRepository.findSession(db, id);
  if (session === null) return null;
  const idle = now.getTime() - session.lastSeenAt.getTime() > PORTAL_SESSION_IDLE_MS;
  if (idle || now.getTime() >= session.expiresAt.getTime()) {
    await portalRepository.remove(db, id);
    return null;
  }
  if (!session.enabled) return null;
  await portalRepository.touch(db, id, now);
  return session.personId;
}

/** Encerra a sessão do cliente, se existir (idempotente). */
export function endPortalSession(db: Database, token: string): Promise<void> {
  return portalRepository.remove(db, sessionIdOf(token));
}
