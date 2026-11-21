"use server";

import { revalidatePath } from "next/cache";
import { updateDefaultTermsRequest } from "@pilla/schemas";
import { updateDefaultTerms } from "@/lib/api/settings";
import { toActionError } from "@/lib/people-action-result";
import type { SettingsActionResult } from "@/components/settings/default-terms-form";

/** Grava a nova vigência dos parâmetros padrão (RF-40). A entrada é revalidada aqui com o schema da API. */
export async function updateDefaultTermsAction(input: unknown): Promise<SettingsActionResult> {
  const parsed = updateDefaultTermsRequest.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Confira os campos.", fieldErrors: {} };
  }
  try {
    const terms = await updateDefaultTerms(parsed.data);
    revalidatePath("/configuracoes");
    return { ok: true, terms };
  } catch (error) {
    const { message, fieldErrors } = toActionError(error);
    return { ok: false, message, fieldErrors };
  }
}
