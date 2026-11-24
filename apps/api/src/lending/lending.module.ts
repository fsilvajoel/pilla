import { Inject, Module } from "@nestjs/common";
import { DashboardService } from "./application/dashboard-service";
import { PortalLoansService } from "./application/portal-loans-service";
import { LoansService } from "./application/loans-service";
import { DefaultTermsController } from "./http/default-terms.controller";
import { DashboardController } from "./http/dashboard.controller";
import { LoansController } from "./http/loans.controller";
import { PortalLoansController } from "./http/portal-loans.controller";

@Module({
  controllers: [LoansController, DefaultTermsController, DashboardController, PortalLoansController],
  providers: [LoansService, DashboardService, PortalLoansService],
})
export class LendingModule {
  /** Serviço do módulo, exposto para outros módulos que precisem dele. */
  readonly service: LoansService;

  constructor(@Inject(LoansService) service: LoansService) {
    this.service = service;
  }
}
