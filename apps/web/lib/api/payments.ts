import {
  allocationPreviewResponse,
  paymentListResponse,
  paymentResponse,
  type AllocationPreviewRequest,
  type AllocationPreviewResponse,
  type CreatePaymentRequest,
  type PaymentListResponse,
  type PaymentResponse,
  type PaymentStatus,
  type RejectPaymentRequest,
  type ReversePaymentRequest,
} from "@pilla/schemas";
import { apiFetch } from "./client";

export interface ListPaymentsParams {
  status?: PaymentStatus;
  loanId?: string;
  limit?: number;
  cursor?: string;
}

/** `If-Match` com a versão do pagamento (E10 D9); sem ele a API responde erro de versão. */
function ifMatch(version: number): Record<string, string> {
  return { "if-match": String(version) };
}

/** POST /payments/allocation-preview: prévia da distribuição por parcela (RF-23). */
export function previewAllocation(body: AllocationPreviewRequest): Promise<AllocationPreviewResponse> {
  return apiFetch({ method: "POST", path: "/payments/allocation-preview", body, schema: allocationPreviewResponse });
}

/** POST /payments: registra em PENDING_REVIEW; a mesma `Idempotency-Key` (1 a 100 caracteres) repete o mesmo pagamento (E11 D8). */
export function createPayment(body: CreatePaymentRequest, idempotencyKey: string): Promise<PaymentResponse> {
  return apiFetch({
    method: "POST",
    path: "/payments",
    body,
    headers: { "idempotency-key": idempotencyKey },
    schema: paymentResponse,
  });
}

/** GET /payments?status=&loanId=&limit=&cursor= (RF-20): fila de conferência com cursor. */
export function listPayments(params: ListPaymentsParams = {}): Promise<PaymentListResponse> {
  return apiFetch({ path: "/payments", query: { ...params }, schema: paymentListResponse });
}

/** POST /payments/{id}/confirm: corpo vazio; `version` vai em `If-Match` (RF-21). */
export function confirmPayment(id: string, version: number): Promise<PaymentResponse> {
  return apiFetch({
    method: "POST",
    path: `/payments/${id}/confirm`,
    body: {},
    headers: ifMatch(version),
    schema: paymentResponse,
  });
}

/** POST /payments/{id}/reject: só pendente, com motivo; `version` vai em `If-Match` (RF-20). */
export function rejectPayment(id: string, version: number, body: RejectPaymentRequest): Promise<PaymentResponse> {
  return apiFetch({
    method: "POST",
    path: `/payments/${id}/reject`,
    body,
    headers: ifMatch(version),
    schema: paymentResponse,
  });
}

/** POST /payments/{id}/reverse: só confirmado, com motivo; `version` vai em `If-Match` (RF-22). */
export function reversePayment(id: string, version: number, body: ReversePaymentRequest): Promise<PaymentResponse> {
  return apiFetch({
    method: "POST",
    path: `/payments/${id}/reverse`,
    body,
    headers: ifMatch(version),
    schema: paymentResponse,
  });
}
