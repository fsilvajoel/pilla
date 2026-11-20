import type { Database } from "../../db/database";
import { isActiveAccountRow } from "../infra/account-repository";

/** Verdadeiro só para conta existente e ativa. */
export function isActiveAccount(db: Database, id: string): Promise<boolean> {
  return isActiveAccountRow(db, id);
}
