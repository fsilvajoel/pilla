// stub E9-F02: esboço do contrato (docs/plano/E9-F02/esboco-api.txt); sai da cobertura até o E9-T03 implementar
import { Controller, Get, Inject } from "@nestjs/common";
import type { HealthResponse } from "@pilla/schemas";
import { DATABASE } from "../../db/database";
import type { Database } from "../../db/database";
@Controller("health")
export class HealthController {
  constructor(@Inject(DATABASE) _db: Database) {}
  @Get()
  check(): Promise<HealthResponse> {
    throw new Error("esboço: não implementado");
  }
}
