"use server";

import { revalidatePath } from "next/cache";
import {
  allocationPreviewRequest,
  createPaymentRequest,
  rejectPaymentRequest,
  reversePaymentRequest,
} from "@pilla/schemas";
import {
  toPaymentActionError,
  type PaymentRecordResult,
  type PreviewActionResult,
} from "@/components/payments/payment-actions";
import { confirmPayment, createPayment, previewAllocation, rejectPayment, reversePayment } from "@/lib/api/payments";

const INVALID_MESSAGE = "Confira os campos do pagamento.";

function invalid(issues: readonly { readonly path: readonly PropertyKey[]; readonly message: string }[]): {
  ok: false;
  code: string;
  message: string;
  fieldErrors: Record<string, string>;
} {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "");
    if (key !== "" && fieldErrors[key] === undefined) fieldErrors[key] = issue.message;
  }
  return { ok: false, code: "VALIDATION_FAILED", message: INVALID_MESSAGE, fieldErrors };
}

function refresh(loanId: string): void {
  revalidatePath("/pagamentos");
  revalidatePath(`/emprestimos/${loanId}`);
}

/** Prévia da alocação (RF-23); a entrada é revalidada aqui. */
export async function previewPaymentAction(input: unknown): Promise<PreviewActionResult> {
  const parsed = allocationPreviewRequest.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  try {
    return { ok: true, data: await previewAllocation(parsed.data) };
  } catch (error) {
    return toPaymentActionError(error);
  }
}

/** Registra o pagamento em PENDING_REVIEW; a mesma `Idempotency-Key` repete o mesmo registro. */
export async function createPaymentAction(input: unknown, idempotencyKey: string): Promise<PaymentRecordResult> {
  const parsed = createPaymentRequest.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  try {
    const payment = await createPayment(parsed.data, idempotencyKey);
    refresh(payment.loanId);
    return { ok: true, data: payment };
  } catch (error) {
    return toPaymentActionError(error);
  }
}

export async function confirmPaymentAction(id: string, version: number): Promise<PaymentRecordResult> {
  try {
    const payment = await confirmPayment(id, version);
    refresh(payment.loanId);
    return { ok: true, data: payment };
  } catch (error) {
    return toPaymentActionError(error);
  }
}

export async function rejectPaymentAction(id: string, version: number, input: unknown): Promise<PaymentRecordResult> {
  const parsed = rejectPaymentRequest.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  try {
    const payment = await rejectPayment(id, version, parsed.data);
    refresh(payment.loanId);
    return { ok: true, data: payment };
  } catch (error) {
    return toPaymentActionError(error);
  }
}

export async function reversePaymentAction(id: string, version: number, input: unknown): Promise<PaymentRecordResult> {
  const parsed = reversePaymentRequest.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  try {
    const payment = await reversePayment(id, version, parsed.data);
    refresh(payment.loanId);
    return { ok: true, data: payment };
  } catch (error) {
    return toPaymentActionError(error);
  }
}
