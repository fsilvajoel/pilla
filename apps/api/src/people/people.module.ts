import { Inject, Module } from "@nestjs/common";
import { PeopleService } from "./application/people.service";
import { AddressesController } from "./http/addresses.controller";
import { PeopleController } from "./http/people.controller";
import { PixKeysController } from "./http/pix-keys.controller";

@Module({ controllers: [PeopleController, AddressesController, PixKeysController], providers: [PeopleService] })
export class PeopleModule {
  /** Serviço do módulo, exposto para outros módulos que precisem consultar pessoas. */
  readonly service: PeopleService;

  constructor(@Inject(PeopleService) service: PeopleService) {
    this.service = service;
  }
}
