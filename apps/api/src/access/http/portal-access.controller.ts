import { Body, Controller, Get, Inject, Param, Put } from "@nestjs/common";
import {
  idSchema,
  setPortalAccessRequest,
  type PortalAccessResponse,
  type SetPortalAccessRequest,
} from "@pilla/schemas";
import { CurrentActor } from "../../core/http/actor";
import { ZodValidationPipe } from "../../core/http/zod-validation.pipe";
import type { RequestActor } from "../../core/public/actor";
import { DATABASE, type Database } from "../../db/database";
import { getPortalAccess, setPortalAccess } from "../application/portal-access-service";

// Chave de acesso ao portal na ficha da pessoa (RF-60, E15 D13). Só ADMIN: o guard global exige a sessão.
@Controller("portal-access")
export class PortalAccessController {
  private readonly db: Database;

  constructor(@Inject(DATABASE) db: Database) {
    this.db = db;
  }

  @Get(":personId")
  get(@Param("personId", new ZodValidationPipe<string>(idSchema)) personId: string): Promise<PortalAccessResponse> {
    return getPortalAccess(this.db, personId);
  }

  @Put(":personId")
  set(
    @Param("personId", new ZodValidationPipe<string>(idSchema)) personId: string,
    @Body(new ZodValidationPipe<SetPortalAccessRequest>(setPortalAccessRequest)) body: SetPortalAccessRequest,
    @CurrentActor() actor: RequestActor,
  ): Promise<PortalAccessResponse> {
    return setPortalAccess(this.db, personId, body.enabled, actor);
  }
}
