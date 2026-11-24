import {
  accountEntryResponse,
  accountListResponse,
  accountStatementResponse,
  treasurySummaryResponse,
  type AccountEntryRequest,
  type AccountEntryResponse,
  type AccountListResponse,
  type AccountStatementResponse,
  type TreasurySummaryResponse,
} from "@pilla/schemas";
import { apiFetch } from "./client";

export interface AccountStatementParams {
  /** Data ISO (AAAA-MM-DD), inclusive. */
  from?: string;
  /** Data ISO (AAAA-MM-DD), inclusive. */
  to?: string;
  /** 1 a 200; padrão da API: 50. */
  limit?: number;
  cursor?: string;
}

/** GET /accounts: contas com saldo derivado (RF-31, RN-T01). */
export function listAccounts(): Promise<AccountListResponse> {
  return apiFetch({ path: "/accounts", schema: accountListResponse });
}

/** POST /accounts/{id}/entries: aporte, retirada ou ajuste (RF-30); a mesma `Idempotency-Key` repete o mesmo lançamento (E12 D4). */
export function createAccountEntry(
  accountId: string,
  body: AccountEntryRequest,
  idempotencyKey: string,
): Promise<AccountEntryResponse> {
  return apiFetch({
    method: "POST",
    path: `/accounts/${accountId}/entries`,
    body,
    headers: { "idempotency-key": idempotencyKey },
    schema: accountEntryResponse,
  });
}

/** GET /accounts/{id}/entries?from=&to=&limit=&cursor=: extrato com saldo após cada item e saldos do período (RF-31, E12 D5). */
export function getAccountStatement(
  accountId: string,
  params: AccountStatementParams = {},
): Promise<AccountStatementResponse> {
  return apiFetch({
    path: `/accounts/${accountId}/entries`,
    query: { ...params },
    schema: accountStatementResponse,
  });
}

/** GET /treasury/summary?month=AAAA-MM: indicadores do painel (RF-32, E12 D7); sem `month`, a API usa o mês corrente em Brasília. */
export function getTreasurySummary(month?: string): Promise<TreasurySummaryResponse> {
  return apiFetch({ path: "/treasury/summary", query: { month }, schema: treasurySummaryResponse });
}
