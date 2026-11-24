// Valores do acesso do portal (RN-A04, CA-09b, pendência de PM E15-T03): constantes no código, sem variável de ambiente.
const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;

/** Tentativas aceitas por IP na janela; a seguinte recebe 429. */
export const PORTAL_ATTEMPT_LIMIT = 30;
/** Janela deslizante do limite por IP. */
export const PORTAL_ATTEMPT_WINDOW_MS = MINUTE_MS;
/** Inatividade máxima da sessão do cliente, desde `last_seen_at`. */
export const PORTAL_SESSION_IDLE_MS = 30 * MINUTE_MS;
/** Teto absoluto da sessão do cliente, gravado em `expires_at`. */
export const PORTAL_SESSION_ABSOLUTE_MS = 2 * HOUR_MS;
/** Tamanho dos segundos de Retry-After. */
export const PORTAL_SECOND_MS = SECOND_MS;
