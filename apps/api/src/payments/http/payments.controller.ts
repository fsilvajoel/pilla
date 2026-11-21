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
import { ZodValidationPipe } from "../../core/http/zod-validation.pipe";
import { PaymentsService } from "../application/payments-service";

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

  /** Esboço (E11-T03): a E11-T04 lê o cabeçalho Idempotency-Key com validação. */
  @Post()
  create(
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body(new ZodValidationPipe<CreatePaymentRequest>(createPaymentRequest)) body: CreatePaymentRequest,
  ): Promise<PaymentResponse> {
    return this.service.create(body, idempotencyKey);
  }

  @Get()
  list(
    @Query(new ZodValidationPipe<PaymentListQuery>(paymentListQuery)) query: PaymentListQuery,
  ): Promise<PaymentListResponse> {
    return this.service.list(query);
  }
}
