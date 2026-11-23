// Cookie da sessão (E14 D4): lido direto do cabeçalho Cookie, sem cookie-parser. Sem Max-Age nem Expires no login:
// a validade é a do servidor.
export const SESSION_COOKIE = "pilla_session";

const ATTRIBUTES = "HttpOnly; Secure; SameSite=Lax; Path=/";
const PREFIX = `${SESSION_COOKIE}=`;

/** Valor do cookie `pilla_session` no cabeçalho Cookie, ou `undefined`. */
export function readSessionCookie(header: string | undefined): string | undefined {
  const pair = (header ?? "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(PREFIX));
  return pair?.slice(PREFIX.length);
}

/** Set-Cookie do login. */
export function sessionCookie(token: string): string {
  return `${PREFIX}${token}; ${ATTRIBUTES}`;
}

/** Set-Cookie do logout: valor vazio, já vencido, com os mesmos atributos. */
export function expiredSessionCookie(): string {
  return `${PREFIX}; ${ATTRIBUTES}; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}
