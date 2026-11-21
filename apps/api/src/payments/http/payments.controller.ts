import { Body, Controller, Get, Headers, HttpCode, Inject, Param, Post, Query } from "@nestjs/common";
import {
  allocationPreviewRequest,
  idSchema,
  createPaymentRequest,
  paymentListQuery,
  type AllocationPreviewRequest,
  type AllocationPreviewResponse,
  type CreatePaymentRequest,
  type PaymentListQuery,
  type PaymentListResponse,
  type PaymentResponse,
} from "@pilla/schemas";
import { z } from "zod";
import { ProblemException } from "../../core/http/problem-exception";
import { ZodValidationPipe } from "../../core/http/zod-validation.pipe";
import { PaymentsService } from "../application/payments-service";

const idempotencyKeySchema = z.string().min(1).max(100).optional();

function idempotencyKeyOf(header: string | undefined): string | undefined {
  const key = idempotencyKeySchema.safeParse(header);
  if (!key.success) {
    throw new ProblemException("VALIDATION_FAILED", "Dados inválidos.", [
      { field: "Idempotency-Key", message: "Use de 1 a 100 caracteres." },
    ]);
  }
  return key.data;
}

/** Versão do cabeçalho `If-Match` (`3` ou `"3"`); null quando falta ou não é um inteiro (E10 D9). */
function ifMatchVersion(header: string | undefined): number | null {
  const match = /^"?(\d+)"?$/.exec(header?.trim() ?? "");
  return match?.[1] === undefined ? null : Number(match[1]);
}

/** Corpo da confirmação: vazio; qualquer chave é recusada. */
const confirmBody = z.strictObject({}).default({});

// Só valida a entrada e traduz HTTP; as regras ficam em PaymentsService.
@Controller("payments")
export class PaymentsController {
  private readonly service: PaymentsService;

  constructor(@Inject(PaymentsService) service: PaymentsService) {
    this.service = service;
  }

  @Post("allocation-preview")
  @HttpCode(200)
  allocationPreview(
    @Body(new ZodValidationPipe<AllocationPreviewRequest>(allocationPreviewRequest)) body: AllocationPreviewRequest,
  ): Promise<AllocationPreviewResponse> {
    return this.service.allocationPreview(body);
  }

  /** Registra em PENDING_REVIEW; `Idempotency-Key` opcional (1 a 100 caracteres) repete o mesmo pagamento (E11 D8). */
  @Post()
  create(
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body(new ZodValidationPipe<CreatePaymentRequest>(createPaymentRequest)) body: CreatePaymentRequest,
  ): Promise<PaymentResponse> {
    return this.service.create(body, idempotencyKeyOf(idempotencyKey));
  }

  /** Esboço (E11-T05): `If-Match` com a versão do pagamento e corpo vazio; a E11-T06 implementa. */
  @Post(":id/confirm")
  @HttpCode(200)
  confirm(
    @Param("id", new ZodValidationPipe<string>(idSchema)) id: string,
    @Headers("if-match") ifMatch: string | undefined,
    @Body(new ZodValidationPipe<Record<string, never>>(confirmBody)) _body: Record<string, never>,
  ): Promise<PaymentResponse> {
    return this.service.confirm(id, ifMatchVersion(ifMatch));
  }

  @Get()
  list(
    @Query(new ZodValidationPipe<PaymentListQuery>(paymentListQuery)) query: PaymentListQuery,
  ): Promise<PaymentListResponse> {
    return this.service.list(query);
  }
}
