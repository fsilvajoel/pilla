// Leitura e validação das variáveis de ambiente da API (docs/travas.md: o app não sobe com config inválida).
// As mensagens de erro nunca incluem o valor lido (DATABASE_URL carrega a senha).
export type ApiEnv = {
  readonly host: "127.0.0.1";
  readonly port: number;
  readonly databaseUrl: string;
  /** Chave do HMAC do CPF no registro de acessos do portal (E15 D5). */
  readonly accessHashKey: string;
};

const PORT_HELP = "informe um inteiro de 1024 a 65535.";
const KEY_HELP = "informe uma chave secreta de pelo menos 32 caracteres.";
const KEY_MIN_LENGTH = 32;
const URL_HELP = "informe postgres://usuario:senha@host:porta/banco.";

function isBlank(value: string | undefined): value is undefined | "" {
  return (value ?? "").trim() === "";
}

function readPort(raw: string | undefined): number {
  if (isBlank(raw)) throw new Error(`PILLA_API_PORT ausente: ${PORT_HELP}`);
  const port = /^[0-9]{4,5}$/.test(raw) ? Number.parseInt(raw, 10) : 0;
  if (port < 1024 || port > 65535) throw new Error(`PILLA_API_PORT inválida: ${PORT_HELP}`);
  return port;
}

function isPostgresUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return (
      (url.protocol === "postgres:" || url.protocol === "postgresql:") && url.hostname !== "" && url.pathname.length > 1
    );
  } catch {
    return false;
  }
}

function readDatabaseUrl(raw: string | undefined): string {
  if (isBlank(raw)) throw new Error(`DATABASE_URL ausente: ${URL_HELP}`);
  if (raw !== raw.trim() || !isPostgresUrl(raw)) throw new Error(`DATABASE_URL inválida: ${URL_HELP}`);
  return raw;
}

function readAccessHashKey(raw: string | undefined): string {
  if (isBlank(raw)) throw new Error(`PILLA_ACCESS_HASH_KEY ausente: ${KEY_HELP}`);
  if (raw.length < KEY_MIN_LENGTH) throw new Error(`PILLA_ACCESS_HASH_KEY inválida: ${KEY_HELP}`);
  return raw;
}

export function readApiEnv(env: Readonly<Record<string, string | undefined>>): ApiEnv {
  return {
    host: "127.0.0.1",
    port: readPort(env["PILLA_API_PORT"]),
    databaseUrl: readDatabaseUrl(env["DATABASE_URL"]),
    accessHashKey: readAccessHashKey(env["PILLA_ACCESS_HASH_KEY"]),
  };
}
