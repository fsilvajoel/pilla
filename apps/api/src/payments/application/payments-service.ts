import { Inject, Injectable } from "@nestjs/common";
import {
  idSchema,
  type AllocationPreviewRequest,
  type AllocationPreviewResponse,
  type CreatePaymentRequest,
  type PaymentListQuery,
  type PaymentListResponse,
  type PaymentResponse,
} from "@pilla/schemas";
import { ProblemException } from "../../core/http/problem-exception";
import type { AuditEntry } from "../../core/public/audit";
import { newId } from "../../core/public/ids";
import { DATABASE, type Database } from "../../db/database";
import { findLoanNumbers, loadLoanForPayment, type PaymentLoan } from "../../lending/public/loan-for-payment";
import { todayInBrasilia } from "../../lending/public/brasilia-today";
import { findPersonNames } from "../../people/public/person-lookup";
import { isActiveAccount } from "../../treasury/public/account-lookup";
import { findPaymentByIdempotencyKey, insertPaymentWithAudit, selectPaymentPage } from "../infra/payment-repository";
import type { PaymentRow } from "../infra/schema";
import { toListItem, toPaymentResponse } from "./payment-views";
import { previewAllocation } from "./preview-allocation";

// Provisório até existir login (Acesso): `created_by` é obrigatório e ainda não há ator real.
const PROVISIONAL_ACTOR_ID = "00000000-0000-7000-8004-000000000001";

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

function auditOf(row: PaymentRow, at: Date): AuditEntry {
  return {
    id: newId(),
    actorType: "ADMIN",
    actorId: null,
    action: "payment.registered",
    entityType: "payment",
    entityId: row.id,
    before: null,
    after: {
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
    },
    at,
    ip: null,
  };
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
  async create(request: CreatePaymentRequest, idempotencyKey: string | undefined): Promise<PaymentResponse> {
    if (idempotencyKey !== undefined) {
      const existing = await findPaymentByIdempotencyKey(this.db, idempotencyKey);
      if (existing !== null) return this.respond(existing);
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
        createdBy: PROVISIONAL_ACTOR_ID,
      },
      (row) => auditOf(row, now),
    );
    return this.respond(stored);
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

  private async loanOf(loanId: string): Promise<PaymentLoan> {
    const loan = await loadLoanForPayment(this.db, loanId);
    if (loan === null) throw new ProblemException("NOT_FOUND", "Recurso não encontrado.");
    return loan;
  }

  private async respond(row: PaymentRow): Promise<PaymentResponse> {
    const loan = await this.loanOf(row.loanId);
    return toPaymentResponse(row, loan, await findPersonNames(this.db, [row.personId]));
  }
}
