"use server";

import { revalidatePath } from "next/cache";
import {
  activateLoan,
  cancelLoan,
  createLoanDraft,
  renegotiateLoan,
  renewLoan,
  updateLoan,
  writeOffLoan,
} from "@/lib/api/loans";
import {
  checkActivateLoan,
  checkCreateLoan,
  checkRenegotiateLoan,
  checkRenewLoan,
  checkUpdateLoan,
  checkWriteOffLoan,
  toLoanActionError,
  type LoanActionResult,
} from "@/components/loans/loan-actions";

function invalid(fieldErrors: Readonly<Record<string, string>>): LoanActionResult {
  return { ok: false, code: "VALIDATION_FAILED", message: "Confira os campos do contrato.", fieldErrors };
}

/** Cria o contrato em rascunho (RF-11). A entrada é revalidada aqui com o schema da API. */
export async function createLoanAction(input: unknown): Promise<LoanActionResult> {
  const check = checkCreateLoan(input);
  if (!check.ok) return invalid(check.fieldErrors);
  try {
    const loan = await createLoanDraft(check.data);
    revalidatePath("/emprestimos");
    return { ok: true, id: loan.id, activeLoansCount: loan.warning.activeLoansCount };
  } catch (error) {
    return toLoanActionError(error);
  }
}

/** Edita o rascunho (PATCH parcial); `version` vai em If-Match. */
export async function updateLoanAction(id: string, version: number, input: unknown): Promise<LoanActionResult> {
  const check = checkUpdateLoan(input);
  if (!check.ok) return invalid(check.fieldErrors);
  try {
    const loan = await updateLoan(id, version, check.data);
    revalidatePath("/emprestimos");
    revalidatePath(`/emprestimos/${id}`);
    return { ok: true, id: loan.id };
  } catch (error) {
    return toLoanActionError(error);
  }
}

/** Ativa o rascunho (desembolso na data e conta); `version` vai em If-Match. */
export async function activateLoanAction(id: string, version: number, input: unknown): Promise<LoanActionResult> {
  const check = checkActivateLoan(input);
  if (!check.ok) return invalid(check.fieldErrors);
  try {
    const loan = await activateLoan(id, version, check.data);
    revalidatePath("/emprestimos");
    revalidatePath(`/emprestimos/${id}`);
    return { ok: true, id: loan.id };
  } catch (error) {
    return toLoanActionError(error);
  }
}

/** Cancela o rascunho; `version` vai em If-Match. */
export async function cancelLoanAction(id: string, version: number): Promise<LoanActionResult> {
  try {
    const loan = await cancelLoan(id, version);
    revalidatePath("/emprestimos");
    revalidatePath(`/emprestimos/${id}`);
    return { ok: true, id: loan.id };
  } catch (error) {
    return toLoanActionError(error);
  }
}

/** Renova: cria o DRAFT de renovação a partir do contrato ativo (RF-13). */
export async function renewLoanAction(id: string, input: unknown): Promise<LoanActionResult> {
  const check = checkRenewLoan(input);
  if (!check.ok) return invalid(check.fieldErrors);
  try {
    const loan = await renewLoan(id, check.data);
    revalidatePath("/emprestimos");
    return { ok: true, id: loan.id };
  } catch (error) {
    return toLoanActionError(error);
  }
}

/** Renegocia: cria o DRAFT com o saldo capitalizado (RF-14). */
export async function renegotiateLoanAction(id: string, input: unknown): Promise<LoanActionResult> {
  const check = checkRenegotiateLoan(input);
  if (!check.ok) return invalid(check.fieldErrors);
  try {
    const loan = await renegotiateLoan(id, check.data);
    revalidatePath("/emprestimos");
    return { ok: true, id: loan.id };
  } catch (error) {
    return toLoanActionError(error);
  }
}

/** Baixa o contrato como perda; o motivo é obrigatório e `version` vai em If-Match (RF-16). */
export async function writeOffLoanAction(id: string, version: number, input: unknown): Promise<LoanActionResult> {
  const check = checkWriteOffLoan(input);
  if (!check.ok) return invalid(check.fieldErrors);
  try {
    const loan = await writeOffLoan(id, version, check.data);
    revalidatePath("/emprestimos");
    revalidatePath(`/emprestimos/${id}`);
    return { ok: true, id: loan.id };
  } catch (error) {
    return toLoanActionError(error);
  }
}
