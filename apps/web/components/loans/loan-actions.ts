import {
  activateLoanRequest,
  createLoanRequest,
  renegotiateLoanRequest,
  renewLoanRequest,
  updateLoanRequest,
  writeOffLoanRequest,
  type ActivateLoanRequest,
  type CreateLoanRequest,
  type LoanStatus,
  type RenegotiateLoanRequest,
  type RenewLoanRequest,
  type UpdateLoanRequest,
  type WriteOffLoanRequest,
} from "@pilla/schemas";
import { toActionError } from "@/lib/people-action-result";

/** Resultado das ações de contrato para a tela; erro sem detalhe interno. */
export type LoanActionResult =
  | { readonly ok: true; readonly id: string; readonly activeLoansCount?: number }
  | {
      readonly ok: false;
      readonly code: string | null;
      readonly message: string;
      readonly fieldErrors: Readonly<Record<string, string>>;
    };

/** Ativar e Cancelar só existem em rascunho (E10 D12). */
export function canActivate(status: LoanStatus): boolean {
  return status === "DRAFT";
}

export function canCancel(status: LoanStatus): boolean {
  return status === "DRAFT";
}

/** Editar só existe em rascunho (E10-T21). */
export function canEdit(status: LoanStatus): boolean {
  return status === "DRAFT";
}

/** Só renderiza o link de pagamento em contrato ACTIVE. */
export function canRegisterPayment(status: LoanStatus): boolean {
  return status === "ACTIVE";
}

/** Renovar, renegociar, baixar e cotar só existem em contrato ACTIVE (E10 D12). */
export function canRollover(status: LoanStatus): boolean {
  return status === "ACTIVE";
}

const MESSAGES: Readonly<Record<string, string>> = {
  VERSION_CONFLICT: "Este contrato foi alterado por outra pessoa. Recarregue a página e tente de novo.",
  LOAN_NOT_EDITABLE: "Só contratos em rascunho podem ser editados, ativados ou cancelados.",
  RENEWAL_REQUIRES_INTEREST_PAID:
    "Há juros ou encargos vencidos em aberto. Pague-os antes de renovar ou use a renegociação.",
  INSUFFICIENT_ACCOUNT_BALANCE: "A conta escolhida não tem saldo para este desembolso.",
};

/** Erro da API (ApiProblem) vira resultado da tela; códigos conhecidos ganham texto próprio. */
export function toLoanActionError(error: unknown): Extract<LoanActionResult, { ok: false }> {
  const result = toActionError(error);
  const own = result.code === null ? undefined : MESSAGES[result.code];
  return own === undefined ? result : { ...result, message: own };
}

function fieldErrorsOf(
  issues: readonly { readonly path: readonly PropertyKey[]; readonly message: string }[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "");
    if (key !== "" && out[key] === undefined) out[key] = issue.message;
  }
  return out;
}

export type Checked<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly fieldErrors: Readonly<Record<string, string>> };

export function checkCreateLoan(input: unknown): Checked<CreateLoanRequest> {
  const parsed = createLoanRequest.safeParse(input);
  return parsed.success
    ? { ok: true, data: parsed.data }
    : { ok: false, fieldErrors: fieldErrorsOf(parsed.error.issues) };
}

export function checkUpdateLoan(input: unknown): Checked<UpdateLoanRequest> {
  const parsed = updateLoanRequest.safeParse(input);
  return parsed.success
    ? { ok: true, data: parsed.data }
    : { ok: false, fieldErrors: fieldErrorsOf(parsed.error.issues) };
}

export function checkActivateLoan(input: unknown): Checked<ActivateLoanRequest> {
  const parsed = activateLoanRequest.safeParse(input);
  return parsed.success
    ? { ok: true, data: parsed.data }
    : { ok: false, fieldErrors: fieldErrorsOf(parsed.error.issues) };
}

export function checkRenewLoan(input: unknown): Checked<RenewLoanRequest> {
  const parsed = renewLoanRequest.safeParse(input);
  return parsed.success
    ? { ok: true, data: parsed.data }
    : { ok: false, fieldErrors: fieldErrorsOf(parsed.error.issues) };
}

export function checkRenegotiateLoan(input: unknown): Checked<RenegotiateLoanRequest> {
  const parsed = renegotiateLoanRequest.safeParse(input);
  return parsed.success
    ? { ok: true, data: parsed.data }
    : { ok: false, fieldErrors: fieldErrorsOf(parsed.error.issues) };
}

export function checkWriteOffLoan(input: unknown): Checked<WriteOffLoanRequest> {
  const parsed = writeOffLoanRequest.safeParse(input);
  return parsed.success
    ? { ok: true, data: parsed.data }
    : { ok: false, fieldErrors: fieldErrorsOf(parsed.error.issues) };
}

/** "AAAA-MM-DD" para "dd/mm/aaaa". */
export function formatDateBr(iso: string): string {
  return iso.split("-").reverse().join("/");
}

/** Filtros de /emprestimos lidos da URL; valores fora do enum são ignorados. */
export function parseLoanFilters(raw: { readonly status?: string; readonly standing?: string }): {
  status?: LoanStatus;
  standing?: "CURRENT" | "OVERDUE";
} {
  const statuses: readonly LoanStatus[] = [
    "DRAFT",
    "ACTIVE",
    "PAID_OFF",
    "RENEWED",
    "RENEGOTIATED",
    "WRITTEN_OFF",
    "CANCELLED",
  ];
  const out: { status?: LoanStatus; standing?: "CURRENT" | "OVERDUE" } = {};
  const status = statuses.find((s) => s === raw.status);
  if (status !== undefined) out.status = status;
  if (raw.standing === "CURRENT" || raw.standing === "OVERDUE") out.standing = raw.standing;
  return out;
}
