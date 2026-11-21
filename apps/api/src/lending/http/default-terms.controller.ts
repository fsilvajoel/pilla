import { Controller, Get, Inject } from "@nestjs/common";
import type { DefaultTermsResponse } from "@pilla/schemas";
import { LoansService } from "../application/loans-service";

@Controller("settings")
export class DefaultTermsController {
  private readonly service: LoansService;

  constructor(@Inject(LoansService) service: LoansService) {
    this.service = service;
  }

  @Get("default-terms")
  get(): Promise<DefaultTermsResponse> {
    return this.service.getDefaultTerms();
  }
}
