// GET /health: sempre 200, com o estado do banco no corpo.
import { Controller, Get, Inject } from "@nestjs/common";
import type { HealthResponse } from "@pilla/schemas";
import { sql } from "drizzle-orm";
import { DATABASE } from "../../db/database";
import type { Database } from "../../db/database";

@Controller("health")
export class HealthController {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  @Get()
  async check(): Promise<HealthResponse> {
    try {
      await this.db.execute(sql`select 1`);
      return { status: "ok", database: "up" };
    } catch {
      // Sem detalhe do erro do banco na resposta.
      return { status: "degraded", database: "down" };
    }
  }
}
