import { Body, Controller, Get, Inject, Put } from "@nestjs/common";
import { updateDefaultTermsRequest, type DefaultTermsResponse, type UpdateDefaultTermsRequest } from "@pilla/schemas";
import { ZodValidationPipe } from "../../core/http/zod-validation.pipe";
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

  @Put("default-terms")
  update(
    @Body(new ZodValidationPipe<UpdateDefaultTermsRequest>(updateDefaultTermsRequest)) body: UpdateDefaultTermsRequest,
  ): Promise<DefaultTermsResponse> {
    return this.service.updateDefaultTerms(body);
  }
}
