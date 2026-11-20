import { Inject, Injectable } from "@nestjs/common";
import type { CreateLoanRequest, DefaultTermsResponse, UpdateLoanRequest } from "@pilla/schemas";
import { ProblemException } from "../../core/http/problem-exception";
import type { AuditEntry } from "../../core/public/audit";
import { newId } from "../../core/public/ids";
import { DATABASE, type Database } from "../../db/database";
import { personExists } from "../../people/public/person-lookup";
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
