import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { loanReopenedV1 } from "@pilla/schemas";
import type { RequestActor } from "../../core/public/actor";
import { newId } from "../../core/public/ids";
import { loanStoreOf } from "../infra/loan-repository";

export type ReopenedLoan = {
  readonly loanId: string;
  /** Motivo do estorno que reabre o contrato. */
  readonly reason: string;
  readonly at: Date;
  /** Quem fez a ação que levou a esta mudança (E14 D11). */
  readonly actor: RequestActor;
};

/**
 * Reabre o contrato PAID_OFF na transação de quem chama (RN-R10): grava ACTIVE com `status_changed_at`, a auditoria
 * e o evento LoanReopened. Quem chama garante que o contrato está travado e que `reopensOnReversal` vale.
 */
export async function reopenLoan(tx: PgDatabase<PgQueryResultHKT>, loan: ReopenedLoan): Promise<void> {
  const store = loanStoreOf(tx);
  const row = await store.reopen(loan.loanId);
  await store.audit({
    id: newId(),
    actorType: "ADMIN",
    actorId: loan.actor.adminUserId,
    action: "loan.reopened",
    entityType: "loan",
    entityId: loan.loanId,
    before: { status: "PAID_OFF", version: row.version - 1 },
    after: { status: row.status, version: row.version, reason: loan.reason },
    at: loan.at,
    ip: loan.actor.ip,
  });
  await store.outbox(
    loanReopenedV1.parse({
      id: newId(),
      type: "LoanReopened",
      version: 1,
      occurredAt: loan.at.toISOString(),
      aggregateId: loan.loanId,
      payload: { loanId: loan.loanId, reason: loan.reason },
    }),
  );
}
