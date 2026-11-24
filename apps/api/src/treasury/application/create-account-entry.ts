import type { AccountEntryRequest, AccountEntryResponse } from "@pilla/schemas";
import { accountEntryResponse } from "@pilla/schemas";
import { ProblemException } from "../../core/http/problem-exception";
import type { RequestActor } from "../../core/public/actor";
import type { AuditEntry } from "../../core/public/audit";
import { nextId } from "./monotonic-id";
import type { Database } from "../../db/database";
import { todayInBrasilia } from "../../lending/public/brasilia-today";
import { findAccountActive, findEntryByIdempotencyKey, insertEntryWithAudit } from "./ledger-repository";
import type { LedgerEntryRow } from "../infra/schema";

function invalid(field: string, message: string): ProblemException {
  return new ProblemException("VALIDATION_FAILED", "Dados inválidos.", [{ field, message }]);
}

/** Aporte entra positivo, retirada sai negativa e o ajuste vale como veio (RF-30). */
function signedAmount(request: AccountEntryRequest): number {
  return request.type === "CAPITAL_OUT" ? -request.amountCents : request.amountCents;
}

/** A chave só repete o mesmo pedido: conta, tipo, valor, data e justificativa iguais ao já gravado. */
function sameRequest(row: LedgerEntryRow, accountId: string, request: AccountEntryRequest): boolean {
  return (
    row.accountId === accountId &&
    row.type === request.type &&
    row.amountCents === signedAmount(request) &&
    row.entryDate === request.entryDate &&
    row.justification === (request.justification ?? null)
  );
}

function replayOf(row: LedgerEntryRow, accountId: string, request: AccountEntryRequest): AccountEntryResponse {
  if (!sameRequest(row, accountId, request)) {
    throw new ProblemException("IDEMPOTENCY_KEY_REUSED", "Idempotency-Key já usada em outro pedido.");
  }
  return toResponse(row);
}

function toResponse(row: LedgerEntryRow): AccountEntryResponse {
  return accountEntryResponse.parse({
    id: row.id,
    accountId: row.accountId,
    type: row.type,
    component: row.component,
    amountCents: row.amountCents,
    entryDate: row.entryDate,
    justification: row.justification,
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    createdAt: row.createdAt.toISOString(),
  });
}

function auditOf(actor: RequestActor, row: LedgerEntryRow, at: Date): AuditEntry {
  return {
    id: nextId(),
    actorType: "ADMIN",
    actorId: actor.adminUserId,
    action: "ledger_entry.created",
    entityType: "ledger_entry",
    entityId: row.id,
    before: null,
    after: {
      id: row.id,
      accountId: row.accountId,
      type: row.type,
      amountCents: row.amountCents,
      entryDate: row.entryDate,
      justification: row.justification,
      createdBy: row.createdBy,
    },
    at,
    ip: actor.ip,
  };
}

/**
 * Lançamento manual na conta (RF-30, RN-T01): grava o lançamento e a auditoria numa transação. Com a mesma
 * `Idempotency-Key`, devolve o lançamento já gravado se o pedido for o mesmo e recusa com 409 se for outro.
 */
export async function createAccountEntry(
  db: Database,
  accountId: string,
  request: AccountEntryRequest,
  idempotencyKey: string | undefined,
  now: Date,
  actor: RequestActor,
): Promise<AccountEntryResponse> {
  if (idempotencyKey !== undefined) {
    const existing = await findEntryByIdempotencyKey(db, idempotencyKey);
    if (existing !== null) return replayOf(existing, accountId, request);
  }
  const active = await findAccountActive(db, accountId);
  if (active === null) throw new ProblemException("NOT_FOUND", "Recurso não encontrado.");
  if (!active) throw invalid("accountId", "Conta inativa.");
  if (request.entryDate > todayInBrasilia(now)) throw invalid("entryDate", "A data não pode ser futura.");
  const id = nextId();
  const stored = await insertEntryWithAudit(
    db,
    {
      id,
      accountId,
      type: request.type,
      amountCents: signedAmount(request),
      entryDate: request.entryDate,
      justification: request.justification ?? null,
      createdBy: actor.adminUserId,
      ...(idempotencyKey === undefined ? {} : { idempotencyKey }),
    },
    (row) => auditOf(actor, row, now),
  );
  return stored.id === id ? toResponse(stored) : replayOf(stored, accountId, request);
}
