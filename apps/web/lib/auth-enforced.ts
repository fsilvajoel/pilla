/** Exigência de login ligada, exceto com PILLA_AUTH_ENFORCED=false (só desenvolvimento; espelha a chave da API). */
export function authEnforced(): boolean {
  return process.env.PILLA_AUTH_ENFORCED?.trim() !== "false";
}

export const AUTH_DISABLED_WARNING = "autenticação DESLIGADA, só desenvolvimento";
