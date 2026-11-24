/** Atributo Secure dos cookies de sessão: ligado, exceto com PILLA_COOKIE_SECURE=false (teste manual em http na LAN). */
export function cookieSecure(): boolean {
  return process.env.PILLA_COOKIE_SECURE !== "false";
}
