import { Inject, Module } from "@nestjs/common";
import { PaymentsService } from "./application/payments-service";
import { PaymentsController } from "./http/payments.controller";

@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {
  /** Serviço do módulo, exposto para outros módulos que precisem dele. */
  readonly service: PaymentsService;

  constructor(@Inject(PaymentsService) service: PaymentsService) {
    this.service = service;
  }
}
