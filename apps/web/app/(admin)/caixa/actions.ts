"use server";

import { revalidatePath } from "next/cache";
import { accountEntryRequest } from "@pilla/schemas";
import { toEntryActionError, type EntryActionResult } from "@/components/treasury/entry-actions";
import { createAccountEntry } from "@/lib/api/treasury";

/** Grava aporte, retirada ou ajuste (RF-30); a mesma `Idempotency-Key` repete o mesmo lançamento. */
export async function createEntryAction(
  accountId: string,
  input: unknown,
  idempotencyKey: string,
): Promise<EntryActionResult> {
  const parsed = accountEntryRequest.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (key !== "" && fieldErrors[key] === undefined) fieldErrors[key] = issue.message;
    }
    return { ok: false, code: "VALIDATION_FAILED", message: "Confira os campos do lançamento.", fieldErrors };
  }
  try {
    const data = await createAccountEntry(accountId, parsed.data, idempotencyKey);
    revalidatePath("/caixa");
    return { ok: true, data };
  } catch (error) {
    return toEntryActionError(error);
  }
}
