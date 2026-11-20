import { Controller, Get, Inject } from "@nestjs/common";
import type { HealthResponse } from "@pilla/schemas";
import { sql } from "drizzle-orm";
import { DATABASE, type Database } from "../../db/database";

@Controller("health")
export class HealthController {
  private readonly db: Database;

  constructor(@Inject(DATABASE) db: Database) {
    this.db = db;
  }

  // Sempre 200: o estado do banco vai no corpo, sem detalhe do erro.
  @Get()
  async check(): Promise<HealthResponse> {
    try {
      await this.db.execute(sql`select 1`);
      return { status: "ok", database: "up" };
    } catch {
      return { status: "degraded", database: "down" };
    }
  }
}
