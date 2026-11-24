import type { PortalAccessResponse } from "@pilla/schemas";
import { ProblemException } from "../../core/http/problem-exception";
import type { RequestActor } from "../../core/public/actor";
import { recordAudit } from "../../core/public/audit";
import { newId } from "../../core/public/ids";
import type { Database } from "../../db/database";
import { personHasCpf } from "../../people/public/person-lookup";
import { portalAccessRepository } from "../infra/portal-access-repository";
import type { PortalAccessRow } from "../infra/schema";

const NO_PERSON = "Pessoa não encontrada.";
const NO_CPF = "Cadastre o CPF para liberar o acesso.";

const responseOf = (personId: string, row: PortalAccessRow | null): PortalAccessResponse => ({
  personId,
  enabled: row?.enabled ?? false,
  enabledAt: row?.enabledAt?.toISOString() ?? null,
});

/** Estado do acesso da pessoa ao portal (E15 D13); quem nunca teve linha está desabilitado. */
export async function getPortalAccess(db: Database, personId: string): Promise<PortalAccessResponse> {
  if ((await personHasCpf(db, personId)) === null) throw new ProblemException("NOT_FOUND", NO_PERSON);
  return responseOf(personId, await portalAccessRepository.find(db, personId));
}

/**
 * Habilita ou desabilita (RF-60, RN-A03, E15 D13). Linha, auditoria e queda das sessões vão na mesma transação;
 * repetir o estado atual não grava nada.
 */
export function setPortalAccess(
  db: Database,
  personId: string,
  enabled: boolean,
  actor: RequestActor,
): Promise<PortalAccessResponse> {
  return db.transaction(async (tx) => {
    const hasCpf = await personHasCpf(tx, personId);
    if (hasCpf === null) throw new ProblemException("NOT_FOUND", NO_PERSON);
    const current = await portalAccessRepository.find(tx, personId);
    if ((current?.enabled ?? false) === enabled) return responseOf(personId, current);
    if (enabled && !hasCpf) throw new ProblemException("PERSON_WITHOUT_CPF", NO_CPF);
    const now = new Date();
    if (enabled) await portalAccessRepository.enable(tx, personId, actor.adminUserId, now);
    else await portalAccessRepository.disable(tx, personId, now);
    await recordAudit(tx, {
      id: newId(),
      actorType: "ADMIN",
      actorId: actor.adminUserId,
      action: enabled ? "PORTAL_ACCESS_ENABLED" : "PORTAL_ACCESS_DISABLED",
      entityType: "portal_access",
      entityId: personId,
      before: current === null ? null : { enabled: current.enabled },
      after: { enabled },
      at: now,
      ip: actor.ip,
    });
    if (!enabled) await portalAccessRepository.deleteClientSessions(tx, personId);
    return responseOf(personId, await portalAccessRepository.find(tx, personId));
  });
}
