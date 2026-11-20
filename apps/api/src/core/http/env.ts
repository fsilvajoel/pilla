// Leitura e validação das variáveis de ambiente da API (docs/travas.md: o app não sobe com config inválida).
// As mensagens de erro nunca incluem o valor lido (a URL carrega a senha do banco).
export type ApiEnv = { readonly host: "127.0.0.1"; readonly port: number; readonly databaseUrl: string };

const portMessage = "informe um inteiro de 1024 a 65535.";
const urlMessage = "informe postgres://usuario:senha@host:porta/banco.";

function readPort(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === "") {
    throw new Error(`PILLA_API_PORT ausente: ${portMessage}`);
  }
  if (!/^[0-9]+$/.test(raw)) {
    throw new Error(`PILLA_API_PORT inválida: ${portMessage}`);
  }
  const port = Number(raw);
  if (port < 1024 || port > 65535) {
    throw new Error(`PILLA_API_PORT inválida: ${portMessage}`);
  }
  return port;
}

function isValidDatabaseUrl(raw: string): boolean {
  if (raw !== raw.trim()) return false;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  const databaseName = url.pathname.replace(/^\//, "");
  return (url.protocol === "postgres:" || url.protocol === "postgresql:") && url.hostname !== "" && databaseName !== "";
}

function readDatabaseUrl(raw: string | undefined): string {
  if (raw === undefined || raw.trim() === "") {
    throw new Error(`DATABASE_URL ausente: ${urlMessage}`);
  }
  if (!isValidDatabaseUrl(raw)) {
    throw new Error(`DATABASE_URL inválida: ${urlMessage}`);
  }
  return raw;
}

export function readApiEnv(env: Readonly<Record<string, string | undefined>>): ApiEnv {
  const port = readPort(env["PILLA_API_PORT"]);
  const databaseUrl = readDatabaseUrl(env["DATABASE_URL"]);
  return { host: "127.0.0.1", port, databaseUrl };
}
