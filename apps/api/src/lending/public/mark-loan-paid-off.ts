import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { loanPaidOffV1 } from "@pilla/schemas";
import type { RequestActor } from "../../core/public/actor";
import { newId } from "../../core/public/ids";
import { loanStoreOf } from "../infra/loan-repository";

export type PaidOffLoan = {
  readonly loanId: string;
  readonly personId: string;
  /** Data do pagamento que zerou o saldo (E10 D3). */
  readonly paidOffAt: string;
  readonly at: Date;
  /** Quem fez a ação que levou a esta mudança (E14 D11). */
  readonly actor: RequestActor;
};

/**
 * Quita o contrato ACTIVE na transação de quem chama (RN-C09): grava PAID_OFF com `status_changed_at`, a auditoria
 * e o evento LoanPaidOff. Quem chama garante que o contrato está ACTIVE, travado, e que o saldo zerou.
 */
export async function markLoanPaidOff(tx: PgDatabase<PgQueryResultHKT>, loan: PaidOffLoan): Promise<void> {
  const store = loanStoreOf(tx);
  const row = await store.markPaidOff(loan.loanId);
  await store.audit({
    id: newId(),
    actorType: "ADMIN",
    actorId: loan.actor.adminUserId,
    action: "loan.paid_off",
    entityType: "loan",
    entityId: loan.loanId,
    before: { status: "ACTIVE", version: row.version - 1 },
    after: { status: row.status, version: row.version },
    at: loan.at,
    ip: loan.actor.ip,
  });
  await store.outbox(
    loanPaidOffV1.parse({
      id: newId(),
      type: "LoanPaidOff",
      version: 1,
      occurredAt: loan.at.toISOString(),
      aggregateId: loan.loanId,
      payload: { loanId: loan.loanId, personId: loan.personId, paidOffAt: loan.paidOffAt },
    }),
  );
}
