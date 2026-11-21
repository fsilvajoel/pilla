import { Body, Controller, HttpCode, Inject, Post } from "@nestjs/common";
import {
  allocationPreviewRequest,
  type AllocationPreviewRequest,
  type AllocationPreviewResponse,
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
}
