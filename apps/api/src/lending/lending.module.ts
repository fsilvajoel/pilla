import { Inject, Module } from "@nestjs/common";
import { LoansService } from "./application/loans-service";
import { DefaultTermsController } from "./http/default-terms.controller";
import { LoansController } from "./http/loans.controller";

@Module({ controllers: [LoansController, DefaultTermsController], providers: [LoansService] })
export class LendingModule {
  /** Serviço do módulo, exposto para outros módulos que precisem dele. */
  readonly service: LoansService;

  constructor(@Inject(LoansService) service: LoansService) {
    this.service = service;
  }
}
