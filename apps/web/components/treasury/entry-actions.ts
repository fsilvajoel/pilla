import type { AccountEntryResponse } from "@pilla/schemas";
import { toActionError } from "@/lib/people-action-result";

/** Resultado do lançamento manual para a tela; erro sem detalhe interno. */
export type EntryActionResult =
  | { readonly ok: true; readonly data: AccountEntryResponse }
  | {
      readonly ok: false;
      readonly code: string | null;
      readonly message: string;
      readonly fieldErrors: Readonly<Record<string, string>>;
    };

/** Textos em pt-BR dos erros do lançamento (E12 D4); o resto usa o texto da API. */
const MESSAGES: Readonly<Record<string, string>> = {
  NOT_FOUND: "Conta não encontrada.",
};

export function toEntryActionError(error: unknown): Extract<EntryActionResult, { ok: false }> {
  const result = toActionError(error);
  const own = result.code === null ? undefined : MESSAGES[result.code];
  return own === undefined ? result : { ...result, message: own };
}
