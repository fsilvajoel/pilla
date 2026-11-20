import {
  accountListResponse,
  idSchema,
  loanDetailResponse,
  loanListResponse,
  payoffQuoteResponse,
  type AccountListResponse,
  type ActivateLoanRequest,
  type CreateLoanRequest,
  type LoanDetailResponse,
  type LoanListResponse,
  type LoanStanding,
  type LoanStatus,
  type PayoffQuoteResponse,
  type UpdateLoanRequest,
} from "@pilla/schemas";
import { z } from "zod";
import { apiFetch } from "./client";

/**
 * Contrato como as rotas de rascunho devolvem (POST/PATCH /loans, cancel, activate).
 * Lacuna: @pilla/schemas ainda não tem o schema desta resposta (só o tipo no serviço da API), então ele vive aqui.
 */
export const loanDraftResponse = z.object({
  id: idSchema,
  loanNumber: z.string(),
  personId: idSchema,
  type: z.string(),
  status: z.string(),
  principalCents: z.number(),
  monthlyInterestRateBps: z.number(),
  installmentCount: z.number().nullable(),
  frequency: z.object({ unit: z.string(), interval: z.number() }),
  firstDueDate: z.string(),
  contractedAt: z.string(),
  accountId: idSchema.nullable(),
  lateFeeBps: z.number(),
  lateInterestMonthlyBps: z.number(),
  gracePeriodDays: z.number(),
  roundingStepCents: z.number(),
  internalNotes: z.string().optional(),
  disbursedAt: z.string().nullable(),
  version: z.number().int(),
});
export type LoanDraftResponse = z.infer<typeof loanDraftResponse>;

/** POST /loans: o rascunho mais o aviso de RN-C11 (contratos da pessoa em andamento). */
export const createLoanResponse = loanDraftResponse.extend({
  warning: z.object({ activeLoansCount: z.number().int() }),
});
export type CreateLoanResponse = z.infer<typeof createLoanResponse>;

export interface ListLoansParams {
  personId?: string;
  status?: LoanStatus;
  standing?: LoanStanding;
  limit?: number;
  cursor?: string;
}

/** `If-Match` com a versão do contrato (E10 D9); sem ele a API responde erro de versão. */
function ifMatch(version: number): Record<string, string> {
  return { "if-match": String(version) };
}

/** GET /loans?personId=&status=&standing=&limit=&cursor= (RF-17). */
export function listLoans(params: ListLoansParams = {}): Promise<LoanListResponse> {
  return apiFetch({ path: "/loans", query: { ...params }, schema: loanListResponse });
}

/** GET /loans/{id} (RF-18). 404 chega como `ApiProblem`. */
export function getLoan(id: string): Promise<LoanDetailResponse> {
  return apiFetch({ path: `/loans/${id}`, schema: loanDetailResponse });
}

/** POST /loans: cria o contrato em rascunho (RF-11, RN-C11). */
export function createLoanDraft(body: CreateLoanRequest): Promise<CreateLoanResponse> {
  return apiFetch({ method: "POST", path: "/loans", body, schema: createLoanResponse });
}

/** PATCH /loans/{id}: só em DRAFT; `version` vai em `If-Match`. */
export function updateLoan(id: string, version: number, body: UpdateLoanRequest): Promise<LoanDraftResponse> {
  return apiFetch({
    method: "PATCH",
    path: `/loans/${id}`,
    body,
    headers: ifMatch(version),
    schema: loanDraftResponse,
  });
}

/** POST /loans/{id}/cancel: só em DRAFT; `version` vai em `If-Match`. */
export function cancelLoan(id: string, version: number): Promise<LoanDraftResponse> {
  return apiFetch({
    method: "POST",
    path: `/loans/${id}/cancel`,
    headers: ifMatch(version),
    schema: loanDraftResponse,
  });
}

/** POST /loans/{id}/activate: desembolso na data e conta; `version` vai em `If-Match`. */
export function activateLoan(id: string, version: number, body: ActivateLoanRequest): Promise<LoanDraftResponse> {
  return apiFetch({
    method: "POST",
    path: `/loans/${id}/activate`,
    body,
    headers: ifMatch(version),
    schema: loanDraftResponse,
  });
}

/** GET /loans/{id}/payoff-quote?date= (RF-18, RN-C08). */
export function getPayoffQuote(id: string, date: string): Promise<PayoffQuoteResponse> {
  return apiFetch({ path: `/loans/${id}/payoff-quote`, query: { date }, schema: payoffQuoteResponse });
}

/** GET /accounts: opções da conta de desembolso/destino (RF-20). */
export function listAccounts(): Promise<AccountListResponse> {
  return apiFetch({ path: "/accounts", schema: accountListResponse });
}
