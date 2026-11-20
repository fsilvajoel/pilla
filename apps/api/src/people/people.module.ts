import { Inject, Module } from "@nestjs/common";
import { PeopleService } from "./application/people.service";
import { PeopleController } from "./http/people.controller";

@Module({ controllers: [PeopleController], providers: [PeopleService] })
export class PeopleModule {
  /** Serviço do módulo, exposto para outros módulos que precisem consultar pessoas. */
  readonly service: PeopleService;

  constructor(@Inject(PeopleService) service: PeopleService) {
    this.service = service;
  }
}
