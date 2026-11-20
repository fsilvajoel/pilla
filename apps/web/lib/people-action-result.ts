import { ApiProblem } from "@/lib/api/problem";

export type PersonActionResult =
  | { readonly ok: true; readonly id: string }
  | {
      readonly ok: false;
      readonly code: string | null;
      readonly message: string;
      readonly fieldErrors: Readonly<Record<string, string>>;
    };

const GENERIC = "Não foi possível salvar agora. Tente de novo.";

/** Converte erro da API em resultado seguro para a tela: sem detalhe interno em erro 5xx ou desconhecido. */
export function toActionError(error: unknown): Extract<PersonActionResult, { ok: false }> {
  if (error instanceof ApiProblem && error.status >= 400 && error.status < 500 && error.code !== null) {
    return { ok: false, code: error.code, message: error.message, fieldErrors: error.fieldMessages() };
  }
  return { ok: false, code: null, message: GENERIC, fieldErrors: {} };
}
