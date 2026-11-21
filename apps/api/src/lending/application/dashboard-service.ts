import { Inject, Injectable } from "@nestjs/common";
import { addDays, isoDate } from "@pilla/finance";
import { dashboardTodayResponse, type DashboardTodayResponse } from "@pilla/schemas";
import { DATABASE, type Database } from "../../db/database";
import { confirmedAllocationsByLoan } from "../../payments/public/confirmed-allocations";
import { findPersonNames } from "../../people/public/person-lookup";
import { selectActiveLoans, selectInstallmentsByLoan } from "../infra/loan-queries";
import { groupDashboardInstallments, WEEK_DAYS, type DashboardLoan } from "./dashboard-today";
import { personNameOf } from "./loans-service";
import { todayInBrasilia } from "./today";

/** Pendentes de conferência: fixo e vazio na F02A; a F02B passa a preenchê-lo. */
const EMPTY_PENDING_REVIEW = { count: 0, totalCents: 0, items: [] };

// Painel (E13-F02A): lê os contratos ACTIVE e devolve o que vence e o que atrasou; nada é gravado (ADR-0005).
@Injectable()
export class DashboardService {
  private readonly db: Database;

  constructor(@Inject(DATABASE) db: Database) {
    this.db = db;
  }

  async today(): Promise<DashboardTodayResponse> {
    const referenceDate = isoDate(todayInBrasilia(new Date()));
    const loans = await selectActiveLoans(this.db);
    const installmentsByLoan = await selectInstallmentsByLoan(
      this.db,
      loans.map((loan) => loan.id),
    );
    const names = await findPersonNames(this.db, [...new Set(loans.map((loan) => loan.personId))]);
    const entries: DashboardLoan[] = [];
    for (const loan of loans) {
      entries.push({
        loan,
        personName: personNameOf(names, loan.personId),
        installments: installmentsByLoan.get(loan.id) ?? [],
        allocations: await confirmedAllocationsByLoan(this.db, loan.id),
      });
    }
    return dashboardTodayResponse.parse({
      referenceDate,
      weekEndDate: addDays(referenceDate, WEEK_DAYS),
      ...groupDashboardInstallments(entries, referenceDate),
      pendingReview: EMPTY_PENDING_REVIEW,
    });
  }
}
