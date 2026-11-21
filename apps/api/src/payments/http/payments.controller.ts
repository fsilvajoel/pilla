import { Body, Controller, Get, Headers, HttpCode, Inject, Post, Query } from "@nestjs/common";
import {
  allocationPreviewRequest,
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

  @Get()
  list(
    @Query(new ZodValidationPipe<PaymentListQuery>(paymentListQuery)) query: PaymentListQuery,
  ): Promise<PaymentListResponse> {
    return this.service.list(query);
  }
}
