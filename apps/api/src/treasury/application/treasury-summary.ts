import type { TreasurySummaryResponse } from "@pilla/schemas";
import type { Database } from "../../db/database";
import { todayInBrasilia } from "../../lending/public/brasilia-today";
import { portfolioFigures } from "../../lending/public/portfolio-figures";
import { totalBalanceCents } from "../public/account-balance";
import { committedShares } from "./committed-shares";
import { baseAccountMaxCommittedBps, monthLedgerTotals } from "../infra/summary-queries";

/** Primeiro e último dia (inclusivos) do mês AAAA-MM. */
function monthBounds(month: string): { monthStart: string; monthEnd: string } {
  const year = Number(month.slice(0, 4));
  const monthNumber = Number(month.slice(5, 7));
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return { monthStart: `${month}-01`, monthEnd: `${month}-${String(lastDay).padStart(2, "0")}` };
}

/** Painel da tesouraria (RF-32, E12 D7): tudo derivado do ledger e da carteira na hora, sem gravar nada (ADR-0005). */
export async function treasurySummary(
  db: Database,
  requestedMonth: string | undefined,
  now: Date,
): Promise<TreasurySummaryResponse> {
  const month = requestedMonth ?? todayInBrasilia(now).slice(0, 7);
  const bounds = monthBounds(month);
  const [cashCents, figures, totals, maxCommittedBps] = await Promise.all([
    totalBalanceCents(db),
    portfolioFigures(db, bounds),
    monthLedgerTotals(db, bounds.monthStart, bounds.monthEnd),
    baseAccountMaxCommittedBps(db),
  ]);
  const lentCents = figures.activeOutstandingPrincipalCents;
  const { committedBps, availableBps } = committedShares(cashCents, lentCents);
  return {
    month,
    cashCents,
    lentCents,
    committedBps,
    availableBps,
    maxCommittedBps,
    interestReceivedCents: totals.interestCents,
    lateChargesReceivedCents: totals.lateChargesCents,
    recoveredCents: totals.recoveredCents,
    lossesCents: figures.writtenOffOutstandingPrincipalCents,
    forecastCents: figures.forecastCents,
  };
}
