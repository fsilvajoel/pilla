// Cria ou redefine o primeiro admin (E14 D9). Uso: pnpm --filter @pilla/api db:seed-admin -- --username <nome>
// A senha nunca vem de argumento nem de variável de ambiente: sai do terminal sem eco (digitada duas vezes)
// ou de uma linha da entrada padrão quando não é terminal. Recusa DATABASE_URL fora de localhost, como o seed.mts.
import { parseArgs } from "node:util";
import readline from "node:readline";
import { createDatabase } from "../src/db/database.ts";
import { seedAdmin } from "../src/access/application/seed-admin.ts";

const ALLOWED_HOSTS: readonly string[] = ["127.0.0.1", "localhost"];

function readDatabaseUrl(): URL {
  const raw = process.env["DATABASE_URL"]?.trim() ?? "";
  if (raw === "") throw new Error("DATABASE_URL ausente ou vazia");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("DATABASE_URL inválida: esperado postgres://usuario:senha@host:porta/banco");
  }
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error("DATABASE_URL inválida: o protocolo deve ser postgres://");
  }
  if (!ALLOWED_HOSTS.includes(url.hostname)) {
    throw new Error("o seed só roda em banco local: o host deve ser 127.0.0.1 ou localhost");
  }
  return url;
}

// Lê uma linha do terminal sem eco: o stdin fica em modo raw e cada tecla é tratada aqui.
function readHidden(prompt: string): Promise<string> {
  const stdin = process.stdin;
  return new Promise<string>((resolve, reject) => {
    let buffer = "";
    const cleanup = (): void => {
      stdin.removeListener("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      process.stdout.write("\n");
    };
    const onData = (chunk: Buffer): void => {
      for (const ch of chunk.toString("utf8")) {
        if (ch === "\r" || ch === "\n") {
          cleanup();
          resolve(buffer);
          return;
        }
        if (ch === "\u0003") {
          cleanup();
          reject(new Error("cancelado pelo usuário"));
          return;
        }
        if (ch === "\u007f" || ch === "\b") {
          buffer = Array.from(buffer).slice(0, -1).join("");
        } else if (ch >= " " && ch !== "\u001b") {
          buffer += ch;
        }
      }
    };
    process.stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.setEncoding("utf8");
    stdin.on("data", onData);
    stdin.resume();
  });
}

// Primeira linha da entrada padrão (fora de terminal).
function readStdinLine(): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, terminal: false });
  return new Promise<string>((resolve, reject) => {
    let answered = false;
    rl.once("line", (line) => {
      answered = true;
      rl.close();
      resolve(line.replace(/\r$/, ""));
    });
    rl.once("close", () => {
      if (!answered) reject(new Error("a entrada padrão terminou sem a senha"));
    });
  });
}

async function readPassword(): Promise<string> {
  if (!process.stdin.isTTY) return readStdinLine();
  const first = await readHidden("Senha: ");
  const second = await readHidden("Repita a senha: ");
  if (first !== second) throw new Error("as senhas não conferem");
  return first;
}

async function main(): Promise<void> {
  const { values } = parseArgs({ options: { username: { type: "string" } }, strict: true });
  if (values.username === undefined) throw new Error("informe --username <nome>");

  const url = readDatabaseUrl();
  const password = await readPassword();
  const handle = createDatabase(url.href);
  try {
    const result = await seedAdmin(handle.db, { username: values.username, password });
    process.stdout.write(`${result}: ${values.username.trim()}\n`);
  } finally {
    await handle.close();
  }
}

// O erro do drizzle traz a query com os parâmetros (hash incluso): aqui sai só a causa vinda do banco.
function describeError(error: unknown): string {
  if (error instanceof Error && error.cause instanceof Error) return `falha ao gravar no banco: ${error.cause.message}`;
  return error instanceof Error ? error.message : String(error);
}

main().catch((error: unknown) => {
  process.stderr.write(`db:seed-admin falhou: ${describeError(error)}\n`);
  process.exit(1);
});
