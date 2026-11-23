import type { Database } from "../../db/database";

/** Mês do painel da tesouraria: primeiro e último dia (YYYY-MM-DD), inclusivos (E12 D7). */
export type PortfolioMonth = { readonly monthStart: string; readonly monthEnd: string };

/** Números da carteira para o painel da tesouraria (E12 D7, D8); nada é gravado (ADR-0005). */
export type PortfolioFigures = {
  readonly activeOutstandingPrincipalCents: number;
  readonly writtenOffOutstandingPrincipalCents: number;
  readonly forecastCents: number;
};

/** Esboço do E12-T07; a implementação é do E12-T08. */
export function portfolioFigures(_db: Database, _month: PortfolioMonth): Promise<PortfolioFigures> {
  return Promise.reject(new Error("esboço: não implementado"));
}
