import { Inject, Injectable } from "@nestjs/common";
import type {
  AllocationPreviewRequest,
  AllocationPreviewResponse,
  CreatePaymentRequest,
  PaymentListQuery,
  PaymentListResponse,
  PaymentResponse,
} from "@pilla/schemas";
import { DATABASE, type Database } from "../../db/database";
import { todayInBrasilia } from "../../lending/public/brasilia-today";
import { previewAllocation } from "./preview-allocation";

@Injectable()
export class PaymentsService {
  private readonly db: Database;

  constructor(@Inject(DATABASE) db: Database) {
    this.db = db;
  }

  /** Prévia da alocação (RF-23); nunca grava. */
  allocationPreview(request: AllocationPreviewRequest): Promise<AllocationPreviewResponse> {
    return previewAllocation(this.db, request, todayInBrasilia(new Date()));
  }

  /** Esboço (E11-T03): registra o pagamento em PENDING_REVIEW (RF-20), implementado na E11-T04. */
  create(_request: CreatePaymentRequest, _idempotencyKey: string | undefined): Promise<PaymentResponse> {
    return Promise.reject(new Error("esboço: não implementado"));
  }

  /** Esboço (E11-T03): lista os pagamentos (RFC-004 §3), implementada na E11-T04. */
  list(_query: PaymentListQuery): Promise<PaymentListResponse> {
    return Promise.reject(new Error("esboço: não implementado"));
  }
}
