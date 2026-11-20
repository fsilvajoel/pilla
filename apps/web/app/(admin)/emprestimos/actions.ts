"use server";

import { revalidatePath } from "next/cache";
import { activateLoan, cancelLoan, createLoanDraft } from "@/lib/api/loans";
import {
  checkActivateLoan,
  checkCreateLoan,
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
