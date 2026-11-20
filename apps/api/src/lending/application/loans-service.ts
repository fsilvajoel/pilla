import { Inject, Injectable } from "@nestjs/common";
import { bps, cents, generateSchedule, isoDate, type ScheduleInput } from "@pilla/finance";
import {
  loanActivatedV1,
  loanRenegotiatedV1,
  loanRenewedV1,
  type ActivateLoanRequest,
  type CreateLoanRequest,
  type DefaultTermsResponse,
  type UpdateLoanRequest,
} from "@pilla/schemas";
import { ProblemException } from "../../core/http/problem-exception";
import type { AuditEntry } from "../../core/public/audit";
import { newId } from "../../core/public/ids";
import { DATABASE, type Database } from "../../db/database";
import { personExists } from "../../people/public/person-lookup";
import { isActiveAccount } from "../../treasury/public/account-lookup";
import { findCurrentDefaultTerms } from "../infra/default-terms-repository";
import { loanRepository, type LoanDraftChanges, type LoanStore } from "../infra/loan-repository";
import type { LoanRow } from "../infra/schema";

const NOT_FOUND_DETAIL = "Recurso não encontrado.";
const TIME_ZONE = "America/Sao_Paulo";

/** Contrato como a API devolve nas rotas de rascunho. */
export type LoanDraftResponse = {
  id: string;
  loanNumber: string;
  personId: string;
  type: string;
  status: string;
  principalCents: number;
  monthlyInterestRateBps: number;
  installmentCount: number | null;
  frequency: { unit: string; interval: number };
  firstDueDate: string;
  contractedAt: string;
  accountId: string | null;
  lateFeeBps: number;
  lateInterestMonthlyBps: number;
  gracePeriodDays: number;
  roundingStepCents: number;
  internalNotes?: string;
  disbursedAt: string | null;
  version: number;
};

/** Aviso de RN-C11: contratos da pessoa já em andamento (só contagem; a situação em atraso vem na F05). */
export type CreateLoanResponse = LoanDraftResponse & { warning: { activeLoansCount: number } };

function toResponse(row: LoanRow): LoanDraftResponse {
  return {
    id: row.id,
    loanNumber: row.loanNumber,
    personId: row.personId,
    type: row.type,
    status: row.status,
    principalCents: row.principalCents,
    monthlyInterestRateBps: row.monthlyInterestRateBps,
    installmentCount: row.installmentCount,
    frequency: { unit: row.frequencyUnit, interval: row.frequencyInterval },
    firstDueDate: row.firstDueDate,
    contractedAt: row.contractedAt,
    accountId: row.accountId,
    lateFeeBps: row.lateFeeBps,
    lateInterestMonthlyBps: row.lateInterestMonthlyBps,
    gracePeriodDays: row.gracePeriodDays,
    roundingStepCents: row.roundingStepCents,
    ...(row.internalNotes === null ? {} : { internalNotes: row.internalNotes }),
    disbursedAt: row.disbursedAt,
    version: row.version,
  };
}

/** Data de hoje em Brasília (D11), no formato AAAA-MM-DD. */
function todayInBrasilia(now: Date): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: TIME_ZONE }).format(now);
}

function auditEntry(action: string, loanId: string, before: LoanRow | null, after: LoanRow, at: Date): AuditEntry {
  return {
    id: newId(),
    actorType: "ADMIN",
    actorId: null,
    action,
    entityType: "loan",
    entityId: loanId,
    before: before === null ? null : toResponse(before),
    after: toResponse(after),
    at,
    ip: null,
  };
}

function changesOf(request: UpdateLoanRequest): LoanDraftChanges {
  const { frequency, ...rest } = request;
  const defined = Object.fromEntries(Object.entries(rest).filter(([, value]) => value !== undefined));
  return {
    ...defined,
    ...(frequency === undefined ? {} : { frequencyUnit: frequency.unit, frequencyInterval: frequency.interval }),
  };
}

// Criar, editar e cancelar rascunho de contrato; ler as condições padrão (E10-F03).
@Injectable()
export class LoansService {
  private readonly db: Database;

  constructor(@Inject(DATABASE) db: Database) {
    this.db = db;
  }

  async create(request: CreateLoanRequest): Promise<CreateLoanResponse> {
    if (!(await personExists(this.db, request.personId))) {
      throw new ProblemException("VALIDATION_FAILED", "Dados inválidos.", [
        { field: "personId", message: "Pessoa não encontrada." },
      ]);
    }
    const terms = await findCurrentDefaultTerms(this.db);
    if (terms === null) throw new ProblemException("INTERNAL_ERROR", "Condições padrão não cadastradas.");
    const now = new Date();
    const today = todayInBrasilia(now);
    return loanRepository(this.db).inTransaction(async (store) => {
      const loanNumber = await store.nextLoanNumber(Number(today.slice(0, 4)));
      const row = await store.insert({
        id: newId(),
        loanNumber,
        personId: request.personId,
        type: request.type,
        status: "DRAFT",
        principalCents: request.principalCents,
        monthlyInterestRateBps: request.monthlyInterestRateBps,
        installmentCount: request.installmentCount,
        frequencyUnit: request.frequency.unit,
        frequencyInterval: request.frequency.interval,
        firstDueDate: request.firstDueDate,
        contractedAt: today,
        lateFeeBps: request.lateFeeBps,
        lateInterestMonthlyBps: request.lateInterestMonthlyBps,
        gracePeriodDays: request.gracePeriodDays,
        roundingStepCents: terms.roundingStepCents,
        ...(request.internalNotes === undefined ? {} : { internalNotes: request.internalNotes }),
      });
      await store.audit(auditEntry("loan.created", row.id, null, row, now));
      const activeLoansCount = await store.countActiveByPerson(request.personId);
      return { ...toResponse(row), warning: { activeLoansCount } };
    });
  }

  async update(id: string, expectedVersion: number | null, request: UpdateLoanRequest): Promise<LoanDraftResponse> {
    return this.inDraft(id, expectedVersion, "loan.updated", async (store, current) => {
      const merged = {
        type: request.type ?? current.type,
        installmentCount: request.installmentCount ?? current.installmentCount,
      };
      if (merged.type === "SINGLE_PAYMENT" && merged.installmentCount !== 1) {
        throw new ProblemException("VALIDATION_FAILED", "Dados inválidos.", [
          { field: "installmentCount", message: "SINGLE_PAYMENT has exactly one installment" },
        ]);
      }
      return store.updateDraft(id, changesOf(request));
    });
  }

  async cancel(id: string, expectedVersion: number | null): Promise<LoanDraftResponse> {
    return this.inDraft(id, expectedVersion, "loan.cancelled", (store) => store.cancel(id));
  }

  // Ativa o DRAFT (E10-F04): parcelas pelo @pilla/finance, evento no outbox e, em renovação ou renegociação,
  // a origem passa a RENEWED/RENEGOTIATED na mesma transação (D8).
  async activate(id: string, expectedVersion: number | null, request: ActivateLoanRequest): Promise<LoanDraftResponse> {
    if (!(await isActiveAccount(this.db, request.accountId))) {
      throw new ProblemException("VALIDATION_FAILED", "Dados inválidos.", [
        { field: "accountId", message: "Conta não encontrada ou inativa." },
      ]);
    }
    return loanRepository(this.db).inTransaction(async (store) => {
      const current = await store.findForUpdate(id);
      if (current === null) throw new ProblemException("NOT_FOUND", NOT_FOUND_DETAIL);
      if (expectedVersion === null || expectedVersion !== current.version) {
        throw new ProblemException("VERSION_CONFLICT", "Versão desatualizada.");
      }
      if (current.status !== "DRAFT") {
        throw new ProblemException("LOAN_NOT_EDITABLE", "Só contrato em rascunho pode ser ativado.");
      }
      if (current.firstDueDate <= request.disbursedAt) {
        throw new ProblemException(
          "FIRST_DUE_DATE_BEFORE_DISBURSEMENT",
          "O primeiro vencimento deve ser posterior ao desembolso.",
        );
      }
      const origin = current.originLoanId === null ? null : await store.findForUpdate(current.originLoanId);
      if (current.originLoanId !== null && (origin === null || origin.status !== "ACTIVE")) {
        throw new ProblemException("LOAN_NOT_EDITABLE", "O contrato de origem não está mais ativo.");
      }
      const schedule = generateSchedule(scheduleInputOf(current, request.disbursedAt));
      const now = new Date();
      const activated = await store.activate(id, request.disbursedAt, request.accountId);
      await store.insertInstallments(
        schedule.map((item) => ({
          id: newId(),
          loanId: id,
          number: item.number,
          dueDate: item.dueDate,
          principalCents: Number(item.principal),
          interestCents: Number(item.interest),
          totalCents: Number(item.total),
        })),
      );
      await store.audit(auditEntry("loan.activated", id, current, activated, now));
      await store.outbox(
        loanActivatedV1.parse({
          id: newId(),
          type: "LoanActivated",
          version: 1,
          occurredAt: now.toISOString(),
          aggregateId: id,
          payload: {
            loanId: id,
            personId: activated.personId,
            accountId: request.accountId,
            principalCents: activated.principalCents,
            disbursedAt: request.disbursedAt,
            ...(activated.originLoanId === null || activated.originType === null
              ? {}
              : { originLoanId: activated.originLoanId, originType: activated.originType }),
          },
        }),
      );
      if (origin !== null) await settleOrigin(store, origin, activated, now);
      return toResponse(activated);
    });
  }

  async getDefaultTerms(): Promise<DefaultTermsResponse> {
    const row = await findCurrentDefaultTerms(this.db);
    if (row === null) throw new ProblemException("NOT_FOUND", NOT_FOUND_DETAIL);
    return {
      lateFeeBps: row.lateFeeBps,
      lateInterestMonthlyBps: row.lateInterestMonthlyBps,
      gracePeriodDays: row.gracePeriodDays,
      suggestedMonthlyRateBps: row.suggestedMonthlyRateBps,
      roundingStepCents: row.roundingStepCents,
    };
  }

  // Trava o contrato, confere versão e DRAFT, aplica a mudança e grava a auditoria na mesma transação.
  private inDraft(
    id: string,
    expectedVersion: number | null,
    action: string,
    apply: (store: LoanStore, current: LoanRow) => Promise<LoanRow>,
  ): Promise<LoanDraftResponse> {
    return loanRepository(this.db).inTransaction(async (store) => {
      const current = await store.findForUpdate(id);
      if (current === null) throw new ProblemException("NOT_FOUND", NOT_FOUND_DETAIL);
      if (expectedVersion === null || expectedVersion !== current.version) {
        throw new ProblemException("VERSION_CONFLICT", "Versão desatualizada.");
      }
      if (current.status !== "DRAFT") {
        throw new ProblemException("LOAN_NOT_EDITABLE", "Só contrato em rascunho pode ser alterado.");
      }
      const updated = await apply(store, current);
      await store.audit(auditEntry(action, id, current, updated, new Date()));
      return toResponse(updated);
    });
  }
}

function scheduleInputOf(row: LoanRow, disbursedAt: string): ScheduleInput {
  const terms = {
    principal: cents(BigInt(row.principalCents)),
    monthlyInterestRate: bps(BigInt(row.monthlyInterestRateBps)),
    firstDueDate: isoDate(row.firstDueDate),
    frequency: {
      unit: row.frequencyUnit === "DAY" ? ("DAY" as const) : ("MONTH" as const),
      interval: row.frequencyInterval,
    },
    disbursementDate: isoDate(disbursedAt),
    roundingStep: cents(BigInt(row.roundingStepCents)),
  };
  if (row.type === "INSTALLMENT") {
    if (row.installmentCount === null) throw new ProblemException("INTERNAL_ERROR", "Contrato sem número de parcelas.");
    return { ...terms, type: "INSTALLMENT", count: row.installmentCount };
  }
  if (row.type === "SINGLE_PAYMENT") return { ...terms, type: "SINGLE_PAYMENT" };
  throw new ProblemException("VALIDATION_FAILED", "Dados inválidos.", [
    { field: "type", message: "Tipo de contrato sem cronograma automático." },
  ]);
}

// Origem de renovação ou renegociação: vira RENEWED/RENEGOTIATED e grava o evento (D8; sem DISBURSEMENT, RN-C16).
async function settleOrigin(store: LoanStore, origin: LoanRow, successor: LoanRow, now: Date): Promise<void> {
  const renegotiation = successor.originType === "RENEGOTIATION";
  const settled = await store.settleOrigin(origin.id, renegotiation ? "RENEGOTIATED" : "RENEWED");
  await store.audit(auditEntry(renegotiation ? "loan.renegotiated" : "loan.renewed", origin.id, origin, settled, now));
  const envelope = { id: newId(), version: 1, occurredAt: now.toISOString(), aggregateId: origin.id };
  await store.outbox(
    renegotiation
      ? loanRenegotiatedV1.parse({
          ...envelope,
          type: "LoanRenegotiated",
          payload: {
            loanId: origin.id,
            successorLoanId: successor.id,
            capitalizedCents: successor.capitalizedAmountCents,
          },
        })
      : loanRenewedV1.parse({
          ...envelope,
          type: "LoanRenewed",
          payload: { loanId: origin.id, successorLoanId: successor.id },
        }),
  );
}
