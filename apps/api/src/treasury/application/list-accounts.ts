import type { AccountListResponse } from "@pilla/schemas";
import type { Database } from "../../db/database";
import { listAccounts } from "../infra/account-repository";

export async function listAccountSummaries(db: Database): Promise<AccountListResponse> {
  return { items: await listAccounts(db) };
}
