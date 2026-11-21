import { Inject, Injectable } from "@nestjs/common";
import { bps, cents, daysBetween, generateSchedule, isoDate, type ScheduleInput } from "@pilla/finance";
import {
  loanActivatedV1,
  loanRenegotiatedV1,
  loanRenewedV1,
  loanWrittenOffV1,
  type ActivateLoanRequest,
  type RenegotiateLoanRequest,
  type RenewLoanRequest,
  type CreateLoanRequest,
  frequencySchema,
  loanDetailResponse,
  loanListItemSchema,
  loanTypeSchema,
  payoffQuoteResponse,
  type DefaultTermsResponse,
  type LoanDetailResponse,
  type LoanListResponse,
  type LoanStanding,
  type PayoffQuoteResponse,
  type UpdateLoanRequest,
  type WriteOffLoanRequest,
} from "@pilla/schemas";
import { ProblemException } from "../../core/http/problem-exception";
import type { AuditEntry } from "../../core/public/audit";
import { newId } from "../../core/public/ids";
import { DATABASE, type Database } from "../../db/database";
import { confirmedAllocationsByLoan } from "../../payments/public/confirmed-allocations";
import { findPersonNames, personExists } from "../../people/public/person-lookup";
import { isActiveAccount } from "../../treasury/public/account-lookup";
import { findCurrentDefaultTerms } from "../infra/default-terms-repository";
import { selectInstallmentsByLoan, selectLoan, selectLoanPage } from "../infra/loan-queries";
import { loanRepository, type LoanDraftChanges, type LoanStore } from "../infra/loan-repository";
import type { InstallmentRow, LoanRow } from "../infra/schema";
import { todayInBrasilia } from "./today";
import { assessLoan, quotePayoff, rolloverFigures, type LoanAssessment } from "./loan-assessment";

const NOT_FOUND_DETAIL = "Recurso não encontrado.";

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

/** DRAFT criado por renovação ou renegociação: o rascunho comum mais a ligação com a origem (RN-C15, RN-C17). */
export type RolloverDraftResponse = LoanDraftResponse & {
  originLoanId: string;
  originType: string;
  capitalizedAmountCents: number;
};

type RolloverKind = "RENEWAL" | "RENEGOTIATION";
type RolloverRequest = RenewLoanRequest | RenegotiateLoanRequest;

/** Filtros e página de GET /loans (já validados na borda). */
export type LoanListParams = {
  personId: string | null;
  status: string | null;
  standing: LoanStanding | null;
  limit: number;
  cursor: string | null;
};

function decodeCursor(cursor: string): string {
  const loanNumber = Buffer.from(cursor, "base64").toString("utf8");
  if (!/^\d{4}-\d{4,}$/.test(loanNumber)) {
    throw new ProblemException("VALIDATION_FAILED", "Dados inválidos.", [
      { field: "cursor", message: "Cursor inválido." },
    ]);
  }
  return loanNumber;
}

function personNameOf(names: Map<string, string>, personId: string): string {
  const name = names.get(personId);
  if (name === undefined) throw new ProblemException("INTERNAL_ERROR", "Pessoa do contrato não encontrada.");
  return name;
}

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

  // Renovar (E10-F06): só com juros e encargos vencidos pagos; o novo DRAFT leva o principal em aberto (RN-C14, RN-C15).
  async renew(id: string, request: RenewLoanRequest): Promise<RolloverDraftResponse> {
    return this.draftFromOrigin(id, request, "RENEWAL");
  }

  // Renegociar (E10-F06): o novo DRAFT leva o saldo devedor; o que excede o principal é capitalizado (RN-C17).
  async renegotiate(id: string, request: RenegotiateLoanRequest): Promise<RolloverDraftResponse> {
    return this.draftFromOrigin(id, request, "RENEGOTIATION");
  }

  // Baixa como perda (E10-F07, RN-C19): ACTIVE vira WRITTEN_OFF com o motivo; o evento leva o principal em aberto.
  // Sem movimentação de dinheiro; o efeito contábil é do consumidor (E12).
  async writeOff(id: string, expectedVersion: number | null, request: WriteOffLoanRequest): Promise<LoanDraftResponse> {
    // Leituras fora da transação (o PGlite tem uma só conexão); a trava e as conferências ficam dentro.
    const installments = await this.installmentsOf(id);
    const allocations = await confirmedAllocationsByLoan(this.db, id);
    return loanRepository(this.db).inTransaction(async (store) => {
      const current = await store.findForUpdate(id);
      if (current === null) throw new ProblemException("NOT_FOUND", NOT_FOUND_DETAIL);
      if (expectedVersion === null || expectedVersion !== current.version) {
        throw new ProblemException("VERSION_CONFLICT", "Versão desatualizada.");
      }
      if (current.status !== "ACTIVE") {
        throw new ProblemException("LOAN_NOT_EDITABLE", "Só contrato ativo pode ser baixado como perda.");
      }
      const now = new Date();
      const figures = rolloverFigures(current, installments, allocations, isoDate(todayInBrasilia(now)));
      const written = await store.writeOff(id, request.reason);
      await store.audit(auditEntry("loan.written_off", id, current, written, now));
      await store.outbox(
        loanWrittenOffV1.parse({
          id: newId(),
          type: "LoanWrittenOff",
          version: 1,
          occurredAt: now.toISOString(),
          aggregateId: id,
          payload: { loanId: id, outstandingPrincipalCents: figures.openPrincipalCents, reason: request.reason },
        }),
      );
      return toResponse(written);
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

  // Lista (E10-F05): filtros de pessoa e status no banco; a situação (standing) é calculada, então a página
  // é montada lendo lotes até juntar `limit + 1` contratos que passam no filtro.
  async list(params: LoanListParams): Promise<LoanListResponse> {
    const today = isoDate(todayInBrasilia(new Date()));
    const matches: { loan: LoanRow; assessment: LoanAssessment }[] = [];
    let after = params.cursor === null ? null : decodeCursor(params.cursor);
    let exhausted = false;
    while (!exhausted && matches.length <= params.limit) {
      const batch = await selectLoanPage(this.db, {
        personId: params.personId,
        status: params.status,
        after,
        take: params.limit + 1,
      });
      exhausted = batch.length <= params.limit;
      const installmentsByLoan = await selectInstallmentsByLoan(
        this.db,
        batch.filter((loan) => loan.status === "ACTIVE").map((loan) => loan.id),
      );
      for (const loan of batch) {
        after = loan.loanNumber;
        const allocations = loan.status === "ACTIVE" ? await confirmedAllocationsByLoan(this.db, loan.id) : [];
        const assessment = assessLoan(loan, installmentsByLoan.get(loan.id) ?? [], allocations, today);
        if (params.standing === null || assessment.standing === params.standing) matches.push({ loan, assessment });
      }
    }
    const page = matches.slice(0, params.limit);
    const names = await findPersonNames(this.db, [...new Set(page.map(({ loan }) => loan.personId))]);
    const last = page[page.length - 1];
    return {
      items: page.map(({ loan, assessment }) =>
        loanListItemSchema.parse({
          id: loan.id,
          loanNumber: loan.loanNumber,
          personName: personNameOf(names, loan.personId),
          principalCents: loan.principalCents,
          outstandingCents: assessment.outstandingCents,
          status: loan.status,
          standing: assessment.standing,
          nextDueDate: assessment.nextDueDate,
        }),
      ),
      // `matches` passa de `limit` só quando há página seguinte, e então `page` não é vazia (limit >= 1).
      nextCursor:
        matches.length > params.limit ? Buffer.from(String(last?.loan.loanNumber), "utf8").toString("base64") : null,
    };
  }

  async detail(id: string): Promise<LoanDetailResponse> {
    const loan = await this.requireLoan(id);
    const installments = await this.installmentsOf(id);
    const allocations = await confirmedAllocationsByLoan(this.db, id);
    const assessment = assessLoan(loan, installments, allocations, isoDate(todayInBrasilia(new Date())));
    const names = await findPersonNames(this.db, [loan.personId]);
    return loanDetailResponse.parse({
      id: loan.id,
      loanNumber: loan.loanNumber,
      personId: loan.personId,
      personName: personNameOf(names, loan.personId),
      type: loanTypeSchema.parse(loan.type),
      status: loan.status,
      version: loan.version,
      standing: assessment.standing,
      principalCents: loan.principalCents,
      monthlyInterestRateBps: loan.monthlyInterestRateBps,
      installmentCount: loan.installmentCount,
      frequency: frequencySchema.parse({ unit: loan.frequencyUnit, interval: loan.frequencyInterval }),
      firstDueDate: loan.firstDueDate,
      contractedAt: loan.contractedAt,
      disbursedAt: loan.disbursedAt,
      lateFeeBps: loan.lateFeeBps,
      lateInterestMonthlyBps: loan.lateInterestMonthlyBps,
      gracePeriodDays: loan.gracePeriodDays,
      roundingStepCents: loan.roundingStepCents,
      totalCents: assessment.totalCents,
      interestCents: assessment.interestCents,
      paidCents: assessment.paidCents,
      outstandingCents: assessment.outstandingCents,
      installments: assessment.installments,
    });
  }

  async payoffQuote(id: string, date: string): Promise<PayoffQuoteResponse> {
    const loan = await this.requireLoan(id);
    if (loan.status !== "ACTIVE") {
      throw new ProblemException("LOAN_NOT_EDITABLE", "Só contrato ativo tem cotação de quitação.");
    }
    // ACTIVE sempre tem desembolso (CHECK loans_disbursed_at_check); String(null) não é data e vira erro 500.
    if (daysBetween(isoDate(String(loan.disbursedAt)), isoDate(date)) < 0) {
      throw new ProblemException("VALIDATION_FAILED", "Dados inválidos.", [
        { field: "date", message: "A data não pode ser anterior ao desembolso." },
      ]);
    }
    const installments = await this.installmentsOf(id);
    const allocations = await confirmedAllocationsByLoan(this.db, id);
    return payoffQuoteResponse.parse({ date, ...quotePayoff(loan, installments, allocations, isoDate(date)) });
  }

  // A origem só muda de status na ativação do novo contrato (D8); aqui nada é gravado nela, no ledger nem no outbox.
  private async draftFromOrigin(
    id: string,
    request: RolloverRequest,
    kind: RolloverKind,
  ): Promise<RolloverDraftResponse> {
    const origin = await this.requireLoan(id);
    if (origin.status !== "ACTIVE") {
      throw new ProblemException("LOAN_NOT_EDITABLE", "Só contrato ativo pode ser renovado ou renegociado.");
    }
    const now = new Date();
    const today = todayInBrasilia(now);
    const figures = rolloverFigures(
      origin,
      await this.installmentsOf(id),
      await confirmedAllocationsByLoan(this.db, id),
      isoDate(today),
    );
    if (kind === "RENEWAL" && figures.overdueInterestCents + figures.lateChargesCents > 0) {
      throw new ProblemException(
        "RENEWAL_REQUIRES_INTEREST_PAID",
        "Há juros ou encargos vencidos em aberto; pague-os ou renegocie.",
      );
    }
    const type = origin.type === "SINGLE_PAYMENT" ? "SINGLE_PAYMENT" : "INSTALLMENT";
    const installmentCount = request.installmentCount ?? origin.installmentCount;
    if (installmentCount === null || (type === "SINGLE_PAYMENT" && installmentCount !== 1)) {
      throw new ProblemException("VALIDATION_FAILED", "Dados inválidos.", [
        { field: "installmentCount", message: "Informe um número de parcelas válido para o tipo do contrato." },
      ]);
    }
    const renewal = kind === "RENEWAL";
    return loanRepository(this.db).inTransaction(async (store) => {
      const row = await store.insert({
        id: newId(),
        loanNumber: await store.nextLoanNumber(Number(today.slice(0, 4))),
        personId: origin.personId,
        type,
        status: "DRAFT",
        principalCents: renewal ? figures.openPrincipalCents : figures.balanceCents,
        monthlyInterestRateBps: request.monthlyInterestRateBps ?? origin.monthlyInterestRateBps,
        installmentCount,
        frequencyUnit: request.frequency?.unit ?? origin.frequencyUnit,
        frequencyInterval: request.frequency?.interval ?? origin.frequencyInterval,
        firstDueDate: request.firstDueDate,
        contractedAt: today,
        originLoanId: origin.id,
        originType: kind,
        capitalizedAmountCents: renewal ? 0 : figures.balanceCents - figures.openPrincipalCents,
        lateFeeBps: origin.lateFeeBps,
        lateInterestMonthlyBps: origin.lateInterestMonthlyBps,
        gracePeriodDays: origin.gracePeriodDays,
        roundingStepCents: origin.roundingStepCents,
      });
      await store.audit(auditEntry("loan.created", row.id, null, row, now));
      return {
        ...toResponse(row),
        originLoanId: origin.id,
        originType: kind,
        capitalizedAmountCents: row.capitalizedAmountCents,
      };
    });
  }

  private async installmentsOf(loanId: string): Promise<InstallmentRow[]> {
    return (await selectInstallmentsByLoan(this.db, [loanId])).get(loanId) ?? [];
  }

  private async requireLoan(id: string): Promise<LoanRow> {
    const loan = await selectLoan(this.db, id);
    if (loan === null) throw new ProblemException("NOT_FOUND", NOT_FOUND_DETAIL);
    return loan;
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
