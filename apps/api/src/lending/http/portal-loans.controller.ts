import { Controller, Get, Inject, Param, UseGuards } from "@nestjs/common";
import type { PortalLoanDetailResponse, PortalLoanListResponse } from "@pilla/schemas";
import { Public } from "../../core/http/public";
import { PortalPerson, type PortalActor } from "../../access/public/portal-person";
import { PortalSessionGuard } from "../../access/public/portal-session.guard";
import { PortalLoansService } from "../application/portal-loans-service";

// Contratos do cliente (RF-61, RF-62, D1): o guard ADMIN global é dispensado e o do portal exige a sessão do cliente.
// Só GET; a pessoa vem de @PortalPerson(), nunca da URL (RFC-004 §4).
@Public()
@UseGuards(PortalSessionGuard)
@Controller("portal/loans")
export class PortalLoansController {
  private readonly service: PortalLoansService;

  constructor(@Inject(PortalLoansService) service: PortalLoansService) {
    this.service = service;
  }

  @Get()
  list(@PortalPerson() person: PortalActor): Promise<PortalLoanListResponse> {
    return this.service.list(person.personId);
  }

  @Get(":id")
  detail(@PortalPerson() person: PortalActor, @Param("id") id: string): Promise<PortalLoanDetailResponse> {
    return this.service.detail(person.personId, id);
  }
}
