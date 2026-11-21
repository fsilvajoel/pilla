import { Body, Controller, Get, Headers, HttpCode, Inject, Param, Patch, Post, Query, Res } from "@nestjs/common";
import {
  activateLoanRequest,
  createLoanRequest,
  idSchema,
  payoffQuoteQuery,
  renegotiateLoanRequest,
  renewLoanRequest,
  updateLoanRequest,
  writeOffLoanRequest,
  type ActivateLoanRequest,
  type CreateLoanRequest,
  type LoanDetailResponse,
  type LoanListResponse,
  type PayoffQuoteQuery,
  type PayoffQuoteResponse,
  type RenegotiateLoanRequest,
  type RenewLoanRequest,
  type UpdateLoanRequest,
  type WriteOffLoanRequest,
} from "@pilla/schemas";
import { ZodValidationPipe } from "../../core/http/zod-validation.pipe";
import { loanListQuery, type LoanListQuery } from "./loan-list-query";
import {
  LoansService,
  type CreateLoanResponse,
  type LoanDraftResponse,
  type RolloverDraftResponse,
} from "../application/loans-service";

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

  @Get()
  list(@Query(new ZodValidationPipe<LoanListQuery>(loanListQuery)) query: LoanListQuery): Promise<LoanListResponse> {
    return this.service.list({
      personId: query.personId ?? null,
      status: query.status ?? null,
      standing: query.standing ?? null,
      limit: query.limit,
      cursor: query.cursor ?? null,
    });
  }

  @Get(":id")
  detail(@Param("id", new ZodValidationPipe<string>(idSchema)) id: string): Promise<LoanDetailResponse> {
    return this.service.detail(id);
  }

  @Get(":id/payoff-quote")
  payoffQuote(
    @Param("id", new ZodValidationPipe<string>(idSchema)) id: string,
    @Query(new ZodValidationPipe<PayoffQuoteQuery>(payoffQuoteQuery)) query: PayoffQuoteQuery,
  ): Promise<PayoffQuoteResponse> {
    return this.service.payoffQuote(id, query.date);
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

  @Post(":id/activate")
  @HttpCode(200)
  activate(
    @Param("id", new ZodValidationPipe<string>(idSchema)) id: string,
    @Headers("if-match") ifMatch: string | undefined,
    @Body(new ZodValidationPipe<ActivateLoanRequest>(activateLoanRequest)) body: ActivateLoanRequest,
  ): Promise<LoanDraftResponse> {
    return this.service.activate(id, ifMatchVersion(ifMatch), body);
  }

  @Post(":id/renew")
  async renew(
    @Param("id", new ZodValidationPipe<string>(idSchema)) id: string,
    @Body(new ZodValidationPipe<RenewLoanRequest>(renewLoanRequest)) body: RenewLoanRequest,
    @Res({ passthrough: true }) response: HeaderSetter,
  ): Promise<RolloverDraftResponse> {
    const loan = await this.service.renew(id, body);
    response.setHeader("Location", `/api/v1/loans/${loan.id}`);
    return loan;
  }

  @Post(":id/renegotiate")
  async renegotiate(
    @Param("id", new ZodValidationPipe<string>(idSchema)) id: string,
    @Body(new ZodValidationPipe<RenegotiateLoanRequest>(renegotiateLoanRequest)) body: RenegotiateLoanRequest,
    @Res({ passthrough: true }) response: HeaderSetter,
  ): Promise<RolloverDraftResponse> {
    const loan = await this.service.renegotiate(id, body);
    response.setHeader("Location", `/api/v1/loans/${loan.id}`);
    return loan;
  }

  @Post(":id/write-off")
  @HttpCode(200)
  writeOff(
    @Param("id", new ZodValidationPipe<string>(idSchema)) id: string,
    @Headers("if-match") ifMatch: string | undefined,
    @Body(new ZodValidationPipe<WriteOffLoanRequest>(writeOffLoanRequest)) body: WriteOffLoanRequest,
  ): Promise<LoanDraftResponse> {
    return this.service.writeOff(id, ifMatchVersion(ifMatch), body);
  }
}
