import type { Database } from "../../db/database";
import { activeBalanceTotal } from "../infra/account-balances";
import { balanceUpTo } from "../infra/ledger-statement";

/** Saldo atual da conta em centavos (soma do ledger, ADR-0005), com sinal. */
export function accountBalanceCents(db: Database, accountId: string): Promise<number> {
  return balanceUpTo(db, accountId, null);
}

/** Soma dos saldos das contas ativas em centavos. */
export function totalBalanceCents(db: Database): Promise<number> {
  return activeBalanceTotal(db);
}
