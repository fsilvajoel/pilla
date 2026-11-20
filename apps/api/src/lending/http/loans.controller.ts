import { Body, Controller, Headers, HttpCode, Inject, Param, Patch, Post, Res } from "@nestjs/common";
import {
  createLoanRequest,
  idSchema,
  updateLoanRequest,
  type CreateLoanRequest,
  type UpdateLoanRequest,
} from "@pilla/schemas";
import { ZodValidationPipe } from "../../core/http/zod-validation.pipe";
import { LoansService, type CreateLoanResponse, type LoanDraftResponse } from "../application/loans-service";

type HeaderSetter = { setHeader(name: string, value: string): unknown };

/** Versão do cabeçalho `If-Match` (`3` ou `"3"`); null quando falta ou não é um inteiro (D9). */
function ifMatchVersion(header: string | undefined): number | null {
  const match = /^"?(\d+)"?$/.exec(header?.trim() ?? "");
  return match?.[1] === undefined ? null : Number(match[1]);
}

// Só valida a entrada e traduz HTTP; as regras ficam em LoansService.
@Controller("loans")
export class LoansController {
  private readonly service: LoansService;

  constructor(@Inject(LoansService) service: LoansService) {
    this.service = service;
  }

  @Post()
  async create(
    @Body(new ZodValidationPipe<CreateLoanRequest>(createLoanRequest)) body: CreateLoanRequest,
    @Res({ passthrough: true }) response: HeaderSetter,
  ): Promise<CreateLoanResponse> {
    const loan = await this.service.create(body);
    response.setHeader("Location", `/api/v1/loans/${loan.id}`);
    return loan;
  }

  @Patch(":id")
  update(
    @Param("id", new ZodValidationPipe<string>(idSchema)) id: string,
    @Headers("if-match") ifMatch: string | undefined,
    @Body(new ZodValidationPipe<UpdateLoanRequest>(updateLoanRequest)) body: UpdateLoanRequest,
  ): Promise<LoanDraftResponse> {
    return this.service.update(id, ifMatchVersion(ifMatch), body);
  }

  @Post(":id/cancel")
  @HttpCode(200)
  cancel(
    @Param("id", new ZodValidationPipe<string>(idSchema)) id: string,
    @Headers("if-match") ifMatch: string | undefined,
  ): Promise<LoanDraftResponse> {
    return this.service.cancel(id, ifMatchVersion(ifMatch));
  }
}
