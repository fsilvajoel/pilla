import type { AccountEntryRequest, AccountEntryResponse } from "@pilla/schemas";
import { accountEntryResponse } from "@pilla/schemas";
import { ProblemException } from "../../core/http/problem-exception";
import type { AuditEntry } from "../../core/public/audit";
import { nextId } from "./monotonic-id";
import type { Database } from "../../db/database";
import { todayInBrasilia } from "../../lending/public/brasilia-today";
import { findAccountActive, findEntryByIdempotencyKey, insertEntryWithAudit } from "./ledger-repository";
import type { LedgerEntryRow } from "../infra/schema";

// Provisório até existir login (Acesso), o mesmo ator de payments.
const PROVISIONAL_ACTOR_ID = "00000000-0000-7000-8004-000000000001";

function invalid(field: string, message: string): ProblemException {
  return new ProblemException("VALIDATION_FAILED", "Dados inválidos.", [{ field, message }]);
}

/** Aporte entra positivo, retirada sai negativa e o ajuste vale como veio (RF-30). */
function signedAmount(request: AccountEntryRequest): number {
  return request.type === "CAPITAL_OUT" ? -request.amountCents : request.amountCents;
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

function auditOf(row: LedgerEntryRow, at: Date): AuditEntry {
  return {
    id: nextId(),
    actorType: "ADMIN",
    actorId: null,
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
    ip: null,
  };
}

/**
 * Lançamento manual na conta (RF-30, RN-T01): grava o lançamento e a auditoria numa transação. Com a mesma
 * `Idempotency-Key`, devolve o lançamento já gravado.
 */
export async function createAccountEntry(
  db: Database,
  accountId: string,
  request: AccountEntryRequest,
  idempotencyKey: string | undefined,
  now: Date,
): Promise<AccountEntryResponse> {
  if (idempotencyKey !== undefined) {
    const existing = await findEntryByIdempotencyKey(db, idempotencyKey);
    if (existing !== null) return toResponse(existing);
  }
  const active = await findAccountActive(db, accountId);
  if (active === null) throw new ProblemException("NOT_FOUND", "Recurso não encontrado.");
  if (!active) throw invalid("accountId", "Conta inativa.");
  if (request.entryDate > todayInBrasilia(now)) throw invalid("entryDate", "A data não pode ser futura.");
  const stored = await insertEntryWithAudit(
    db,
    {
      id: nextId(),
      accountId,
      type: request.type,
      amountCents: signedAmount(request),
      entryDate: request.entryDate,
      justification: request.justification ?? null,
      createdBy: PROVISIONAL_ACTOR_ID,
      ...(idempotencyKey === undefined ? {} : { idempotencyKey }),
    },
    (row) => auditOf(row, now),
  );
  return toResponse(stored);
}
