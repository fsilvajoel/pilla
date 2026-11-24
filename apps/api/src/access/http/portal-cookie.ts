import { PORTAL_SECOND_MS, PORTAL_SESSION_ABSOLUTE_MS } from "../application/portal-policy";

// Cookie do portal (E15 D6): lido do cabeçalho Cookie à mão, sem cookie-parser. Path restrito às rotas do portal.
export const PORTAL_COOKIE = "pilla_portal";

const PREFIX = `${PORTAL_COOKIE}=`;
const ATTRIBUTES = "HttpOnly; Secure; SameSite=Lax; Path=/api/v1/portal";
/** 32 bytes em base64url (`newSessionToken`): qualquer outra forma nem chega ao banco. */
const TOKEN_FORMAT = /^[A-Za-z0-9_-]{43}$/;

/** Token bem formado do cookie `pilla_portal` no cabeçalho Cookie, ou `undefined`. */
export function readPortalToken(header: string | undefined): string | undefined {
  const pair = (header ?? "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(PREFIX));
  const value = pair?.slice(PREFIX.length) ?? "";
  return TOKEN_FORMAT.test(value) ? value : undefined;
}

/** Set-Cookie da entrada: dura o teto absoluto da sessão. */
export function portalCookie(token: string): string {
  return `${PREFIX}${token}; ${ATTRIBUTES}; Max-Age=${String(PORTAL_SESSION_ABSOLUTE_MS / PORTAL_SECOND_MS)}`;
}

/** Set-Cookie da saída: valor vazio, já vencido, com os mesmos atributos. */
export function expiredPortalCookie(): string {
  return `${PREFIX}; ${ATTRIBUTES}; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}
