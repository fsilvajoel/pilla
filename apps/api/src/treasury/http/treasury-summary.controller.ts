import { Controller, Get, Inject, Query } from "@nestjs/common";
import { treasurySummaryQuery, type TreasurySummaryQuery, type TreasurySummaryResponse } from "@pilla/schemas";
import { ZodValidationPipe } from "../../core/http/zod-validation.pipe";
import { DATABASE, type Database } from "../../db/database";
import { treasurySummary } from "../application/treasury-summary";

@Controller("treasury")
export class TreasurySummaryController {
  private readonly db: Database;

  constructor(@Inject(DATABASE) db: Database) {
    this.db = db;
  }

  /** Painel da tesouraria (RF-32): caixa, emprestado, percentuais, indicadores e previsão do mês. */
  @Get("summary")
  summary(
    @Query(new ZodValidationPipe<TreasurySummaryQuery>(treasurySummaryQuery)) query: TreasurySummaryQuery,
  ): Promise<TreasurySummaryResponse> {
    return treasurySummary(this.db, query.month, new Date());
  }
}
