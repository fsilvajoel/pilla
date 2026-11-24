// Leitura e validação das variáveis de ambiente da API (docs/travas.md: o app não sobe com config inválida).
// As mensagens de erro nunca incluem o valor lido (DATABASE_URL carrega a senha).
export type ApiEnv = {
  readonly host: "127.0.0.1";
  readonly port: number;
  readonly databaseUrl: string;
  /** Ausente vale `true`. `false` (PILLA_AUTH_ENFORCED=false) desliga a exigência de sessão: só desenvolvimento. */
  readonly authEnforced?: boolean;
};

const PORT_HELP = "informe um inteiro de 1024 a 65535.";
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

export function readApiEnv(env: Readonly<Record<string, string | undefined>>): ApiEnv {
  return {
    host: "127.0.0.1",
    port: readPort(env["PILLA_API_PORT"]),
    databaseUrl: readDatabaseUrl(env["DATABASE_URL"]),
    authEnforced: env["PILLA_AUTH_ENFORCED"]?.trim() !== "false",
  };
}
