import { Inject, Injectable } from "@nestjs/common";
import { daysBetween, isoDate } from "@pilla/finance";
import {
  idSchema,
  installmentPaidV1,
  paymentConfirmedV1,
  paymentReversedV1,
  type PaymentAllocation,
  type AllocationPreviewRequest,
  type AllocationPreviewResponse,
  type CreatePaymentRequest,
  type PaymentListQuery,
  type PaymentListResponse,
  type PaymentResponse,
  type RejectPaymentRequest,
  type ReversePaymentRequest,
} from "@pilla/schemas";
import { isReversalBlocked, reopensOnReversal } from "../../lending/domain/reversal";
import { ProblemException } from "../../core/http/problem-exception";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { RequestActor } from "../../core/public/actor";
import { recordAudit, type AuditEntry } from "../../core/public/audit";
import { writeOutboxEvent } from "../../core/infra/outbox-writer";
import { newId } from "../../core/public/ids";
import { DATABASE, type Database } from "../../db/database";
import { findLoanNumbers, loadLoanForPayment, type PaymentLoan } from "../../lending/public/loan-for-payment";
import { todayInBrasilia } from "../../lending/public/brasilia-today";
import { markLoanPaidOff } from "../../lending/public/mark-loan-paid-off";
import { reopenLoan } from "../../lending/public/reopen-loan";
import { findPersonNames } from "../../people/public/person-lookup";
import { isActiveAccount } from "../../treasury/public/account-lookup";
import {
  findPaymentByIdempotencyKey,
  findPaymentForUpdate,
  insertAllocations,
  insertPaymentWithAudit,
  markAllocationsReversed,
  markPaymentConfirmed,
  markPaymentRejected,
  markPaymentReversed,
  selectPaymentPage,
} from "../infra/payment-repository";
import type { PaymentRow } from "../infra/schema";
import { toListItem, toPaymentResponse } from "./payment-views";
import { confirmedAllocationsByLoan } from "../public/confirmed-allocations";
import { previewAllocation, previewForLoan } from "./preview-allocation";

function invalid(field: string, message: string): ProblemException {
  return new ProblemException("VALIDATION_FAILED", "Dados inválidos.", [{ field, message }]);
}

/** Id do último item da página, em base64 (opaco para quem chama). */
const encodeCursor = (id: string): string => Buffer.from(id, "utf8").toString("base64");

function decodeCursor(cursor: string): string {
  const id = idSchema.safeParse(Buffer.from(cursor, "base64").toString("utf8"));
  if (!id.success) throw invalid("cursor", "Cursor inválido.");
  return id.data;
}

/** Trava o pagamento e confere o status esperado e a versão do If-Match (E11 D4). */
async function lockPayment(
  tx: PgDatabase<PgQueryResultHKT>,
  id: string,
  expectedVersion: number | null,
  expected: {
    readonly status: string;
    readonly code: "PAYMENT_NOT_PENDING" | "PAYMENT_NOT_CONFIRMED";
    readonly message: string;
  },
): Promise<PaymentRow> {
  const current = await findPaymentForUpdate(tx, id);
  if (current === null) throw new ProblemException("NOT_FOUND", "Recurso não encontrado.");
  if (current.status !== expected.status) throw new ProblemException(expected.code, expected.message);
  if (expectedVersion === null || expectedVersion !== current.version) {
    throw new ProblemException("VERSION_CONFLICT", "Versão desatualizada.");
  }
  return current;
}

/** Confirmação e rejeição: PENDING_REVIEW. */
function lockPendingPayment(
  tx: PgDatabase<PgQueryResultHKT>,
  id: string,
  expectedVersion: number | null,
): Promise<PaymentRow> {
  return lockPayment(tx, id, expectedVersion, {
    status: "PENDING_REVIEW",
    code: "PAYMENT_NOT_PENDING",
    message: "O pagamento não está em conferência.",
  });
}

/** Estorno: CONFIRMED. */
function lockConfirmedPayment(
  tx: PgDatabase<PgQueryResultHKT>,
  id: string,
  expectedVersion: number | null,
): Promise<PaymentRow> {
  return lockPayment(tx, id, expectedVersion, {
    status: "CONFIRMED",
    code: "PAYMENT_NOT_CONFIRMED",
    message: "O pagamento não está confirmado.",
  });
}

function auditSnapshot(row: PaymentRow): Record<string, unknown> {
  return {
    id: row.id,
    loanId: row.loanId,
    personId: row.personId,
    accountId: row.accountId,
    paidAt: row.paidAt,
    amountCents: row.amountCents,
    method: row.method,
    channel: row.channel,
    status: row.status,
    isRecovery: row.isRecovery,
    version: row.version,
  };
}

function auditOf(
  actor: RequestActor,
  row: PaymentRow,
  at: Date,
  action: string,
  before: PaymentRow | null,
  extra: Record<string, unknown> = {},
): AuditEntry {
  return {
    id: newId(),
    actorType: "ADMIN",
    actorId: actor.adminUserId,
    action,
    entityType: "payment",
    entityId: row.id,
    before: before === null ? null : auditSnapshot(before),
    after: { ...auditSnapshot(row), ...extra },
    at,
    ip: actor.ip,
  };
}

async function loadLoanOrFail(
  db: PgDatabase<PgQueryResultHKT>,
  loanId: string,
  forUpdate: boolean,
): Promise<PaymentLoan> {
  const loan = await loadLoanForPayment(db, loanId, { forUpdate });
  if (loan === null) throw new ProblemException("NOT_FOUND", "Recurso não encontrado.");
  return loan;
}

/** Principal e juros em aberto do contrato depois do estorno, sem encargos, em centavos (independe da data). */
async function openPrincipalAndInterest(tx: PgDatabase<PgQueryResultHKT>, loan: PaymentLoan): Promise<bigint> {
  const confirmed = await confirmedAllocationsByLoan(tx, loan.id);
  const scheduled = loan.installments.reduce((sum, item) => sum + item.principalCents + item.interestCents, 0);
  const paid = confirmed.reduce((sum, item) => sum + item.principalCents + item.interestCents, 0);
  return BigInt(scheduled - paid);
}

@Injectable()
export class PaymentsService {
  private readonly db: Database;

  constructor(@Inject(DATABASE) db: Database) {
    this.db = db;
  }

  /** Prévia da alocação (RF-23); nunca grava. */
  allocationPreview(request: AllocationPreviewRequest): Promise<AllocationPreviewResponse> {
    return previewAllocation(this.db, request, todayInBrasilia(new Date()));
  }

  /**
   * Registra o pagamento em PENDING_REVIEW (RF-20, RN-R01): grava só o pagamento e a auditoria, sem alocação, evento
   * nem efeito no saldo. Valor, data e situação do contrato seguem a mesma regra da prévia. A mesma Idempotency-Key
   * devolve o pagamento já criado (E11 D8).
   */
  async create(
    request: CreatePaymentRequest,
    idempotencyKey: string | undefined,
    actor: RequestActor,
  ): Promise<PaymentResponse> {
    if (idempotencyKey !== undefined) {
      const existing = await findPaymentByIdempotencyKey(this.db, idempotencyKey);
      if (existing !== null) return this.respond(existing, []);
    }
    const loan = await this.loanOf(request.loanId);
    if (!(await isActiveAccount(this.db, request.accountId))) {
      throw invalid("accountId", "Conta não encontrada ou inativa.");
    }
    const now = new Date();
    await previewAllocation(this.db, request, todayInBrasilia(now));
    const stored = await insertPaymentWithAudit(
      this.db,
      {
        id: newId(),
        loanId: loan.id,
        personId: loan.personId,
        accountId: request.accountId,
        paidAt: request.paidAt,
        amountCents: request.amountCents,
        method: request.method,
        channel: "ADMIN",
        status: "PENDING_REVIEW",
        isRecovery: loan.status === "WRITTEN_OFF",
        ...(idempotencyKey === undefined ? {} : { idempotencyKey }),
        createdBy: actor.adminUserId,
      },
      (row) => auditOf(actor, row, now, "payment.registered", null),
    );
    return this.respond(stored, []);
  }

  /** Lista de pagamentos (RFC-004 §3) com o número do contrato e o nome da pessoa. */
  async list(query: PaymentListQuery): Promise<PaymentListResponse> {
    const rows = await selectPaymentPage(this.db, {
      status: query.status ?? null,
      loanId: query.loanId ?? null,
      limit: query.limit,
      afterId: query.cursor === undefined ? null : decodeCursor(query.cursor),
    });
    const page = rows.slice(0, query.limit);
    const loanNumbers = await findLoanNumbers(this.db, [...new Set(page.map((row) => row.loanId))]);
    const personNames = await findPersonNames(this.db, [...new Set(page.map((row) => row.personId))]);
    // Havendo uma linha além da página, o cursor é o id do último item da página.
    const cursors = rows.length > query.limit ? page.slice(-1).map((row) => encodeCursor(row.id)) : [];
    return {
      items: page.map((row) => toListItem(row, loanNumbers, personNames)),
      nextCursor: cursors[0] ?? null,
    };
  }

  /**
   * Confirma o pagamento (RF-21, E11 D4 a D10), em uma transação que trava o pagamento e depois o contrato:
   * recalcula a distribuição em `paidAt` com o estado de agora, grava a alocação, marca CONFIRMED, quita o
   * contrato ACTIVE que zerou e grava auditoria e eventos. Qualquer recusa desfaz tudo.
   */
  async confirm(id: string, expectedVersion: number | null, actor: RequestActor): Promise<PaymentResponse> {
    const now = new Date();
    const confirmed = await this.db.transaction(async (tx) => {
      const current = await lockPendingPayment(tx, id, expectedVersion);
      const loan = await loadLoanOrFail(tx, current.loanId, true);
      if (loan.status === "DRAFT") {
        throw new ProblemException("LOAN_NOT_ACTIVE", "O contrato ainda não foi ativado.");
      }
      const preview = await previewForLoan(
        tx,
        loan,
        { loanId: loan.id, amountCents: current.amountCents, paidAt: current.paidAt },
        todayInBrasilia(now),
      );
      const touched = new Map(preview.allocations.map((item) => [item.installmentNumber, item]));
      const parts = loan.installments.flatMap((installment) => {
        const item = touched.get(installment.number);
        return item === undefined ? [] : [{ installment, item }];
      });
      const stored = await markPaymentConfirmed(tx, id, {
        confirmedAt: now,
        confirmedBy: actor.adminUserId,
        isRecovery: loan.status === "WRITTEN_OFF",
      });
      await insertAllocations(
        tx,
        parts.map(({ installment, item }) => ({
          id: newId(),
          paymentId: id,
          loanId: loan.id,
          installmentId: installment.id,
          lateChargesCents: item.lateChargesCents,
          interestCents: item.interestCents,
          principalCents: item.principalCents,
        })),
      );
      await recordAudit(tx, auditOf(actor, stored, now, "payment.confirmed", current));
      await writeOutboxEvent(
        tx,
        paymentConfirmedV1.parse({
          id: newId(),
          type: "PaymentConfirmed",
          version: 1,
          occurredAt: now.toISOString(),
          aggregateId: id,
          payload: {
            paymentId: id,
            loanId: loan.id,
            personId: stored.personId,
            accountId: stored.accountId,
            paidAt: stored.paidAt,
            amountCents: stored.amountCents,
            isRecovery: stored.isRecovery,
            allocations: parts.map(({ installment, item }) => ({
              installmentId: installment.id,
              lateChargesCents: item.lateChargesCents,
              interestCents: item.interestCents,
              principalCents: item.principalCents,
            })),
          },
        }),
      );
      for (const { installment, item } of parts) {
        if (item.installmentStatusAfter !== "PAID") continue;
        await writeOutboxEvent(
          tx,
          installmentPaidV1.parse({
            id: newId(),
            type: "InstallmentPaid",
            version: 1,
            occurredAt: now.toISOString(),
            aggregateId: installment.id,
            payload: {
              installmentId: installment.id,
              loanId: loan.id,
              paidAt: stored.paidAt,
              daysLate: Math.max(0, daysBetween(isoDate(installment.dueDate), isoDate(stored.paidAt))),
            },
          }),
        );
      }
      if (preview.paysOff) {
        await markLoanPaidOff(tx, {
          loanId: loan.id,
          personId: loan.personId,
          paidOffAt: stored.paidAt,
          at: now,
          actor,
        });
      }
      const allocations: PaymentAllocation[] = preview.allocations.map((item) => ({
        installmentNumber: item.installmentNumber,
        lateChargesCents: item.lateChargesCents,
        interestCents: item.interestCents,
        principalCents: item.principalCents,
      }));
      return { stored, allocations };
    });
    return this.respond(confirmed.stored, confirmed.allocations);
  }

  /**
   * Rejeita o pagamento pendente (RF-20, E11 D12): trava o pagamento, confere PENDING_REVIEW e a versão, grava
   * REJECTED com o motivo e a auditoria `payment.rejected`. Sem alocação, evento nem efeito no contrato (RN-R01).
   */
  async reject(
    id: string,
    expectedVersion: number | null,
    request: RejectPaymentRequest,
    actor: RequestActor,
  ): Promise<PaymentResponse> {
    const now = new Date();
    const stored = await this.db.transaction(async (tx) => {
      const current = await lockPendingPayment(tx, id, expectedVersion);
      const rejected = await markPaymentRejected(tx, id, {
        rejectedAt: now,
        rejectedBy: actor.adminUserId,
        reason: request.reason,
      });
      await recordAudit(tx, auditOf(actor, rejected, now, "payment.rejected", current, { reason: request.reason }));
      return rejected;
    });
    return this.respond(stored, []);
  }

  /**
   * Estorna o pagamento confirmado (RF-22, E11 D3 e D10), em uma transação que trava o pagamento e depois o contrato:
   * bloqueia contrato RENEWED/RENEGOTIATED (RN-R11), marca as alocações e o pagamento (nada é apagado, RN-R07),
   * reabre o contrato PAID_OFF que voltou a ter principal ou juros em aberto (RN-R10) e grava auditoria e eventos.
   */
  async reverse(
    id: string,
    expectedVersion: number | null,
    request: ReversePaymentRequest,
    actor: RequestActor,
  ): Promise<PaymentResponse> {
    const now = new Date();
    const stored = await this.db.transaction(async (tx) => {
      const current = await lockConfirmedPayment(tx, id, expectedVersion);
      const loan = await loadLoanOrFail(tx, current.loanId, true);
      if (isReversalBlocked(loan.status)) {
        throw new ProblemException(
          "REVERSAL_BLOCKED_BY_SUCCESSOR",
          "O contrato foi renovado ou renegociado; o pagamento não pode ser estornado.",
          undefined,
          loan.successorLoanId ?? undefined,
        );
      }
      const marked = await markAllocationsReversed(tx, id, now);
      const reversed = await markPaymentReversed(tx, id, {
        reversedAt: now,
        reversedBy: actor.adminUserId,
        reason: request.reason,
      });
      await recordAudit(tx, auditOf(actor, reversed, now, "payment.reversed", current, { reason: request.reason }));
      await writeOutboxEvent(
        tx,
        paymentReversedV1.parse({
          id: newId(),
          type: "PaymentReversed",
          version: 1,
          occurredAt: now.toISOString(),
          aggregateId: id,
          payload: {
            paymentId: id,
            loanId: loan.id,
            accountId: reversed.accountId,
            amountCents: reversed.amountCents,
            allocations: marked.map((item) => ({
              installmentId: item.installmentId,
              lateChargesCents: item.lateChargesCents,
              interestCents: item.interestCents,
              principalCents: item.principalCents,
            })),
            reason: request.reason,
          },
        }),
      );
      // ADR-0005: o saldo vem do cronograma menos as alocações que seguem confirmadas, não de um valor guardado.
      const outstanding = await openPrincipalAndInterest(tx, loan);
      if (reopensOnReversal(loan.status, outstanding)) {
        await reopenLoan(tx, { loanId: loan.id, reason: request.reason, at: now, actor });
      }
      return reversed;
    });
    return this.respond(stored, []);
  }

  private loanOf(loanId: string): Promise<PaymentLoan> {
    return loadLoanOrFail(this.db, loanId, false);
  }

  private async respond(row: PaymentRow, allocations: readonly PaymentAllocation[]): Promise<PaymentResponse> {
    const loan = await this.loanOf(row.loanId);
    return toPaymentResponse(row, loan, await findPersonNames(this.db, [row.personId]), allocations);
  }
}
