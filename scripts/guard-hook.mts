// Hook PreToolUse do Claude Code (.claude/settings.json). Lê o evento em JSON no stdin e bloqueia (exit 2,
// motivo no stderr):
// - Bash que pula hooks do git (--no-verify, commit -n, core.hooksPath, LEFTHOOK=0);
// - qualquer acesso a .env (exceto .env.example) por Read/Edit/Write/MultiEdit/NotebookEdit/Grep/Glob/Bash;
// - escrita (Edit/Write/MultiEdit/NotebookEdit) fora do repositório.
// Entrada inválida também bloqueia: o hook falha fechado.
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";

export type Decision = { readonly allow: true } | { readonly allow: false; readonly reason: string };

export interface HookInput {
  readonly toolName: string;
  readonly toolInput: Readonly<Record<string, unknown>>;
  readonly cwd: string;
}

const ALLOW: Decision = { allow: true };
const WRITE_TOOLS = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);
const PATH_KEYS = ["file_path", "notebook_path", "path"] as const;
const COMMIT_VALUE_FLAGS = new Set(["m", "F", "C", "c", "t", "S", "u"]);
const GIT_GLOBAL_VALUE_FLAGS = new Set(["-c", "-C", "--git-dir", "--work-tree", "--namespace", "--exec-path"]);
const SEPARATORS = new Set([";", "&&", "||", "|", "&", "(", ")", "\n"]);

function deny(reason: string): Decision {
  return { allow: false, reason };
}

/** `.env` e variantes (`.env.local`, `.env.production`); `.env.example` é permitido. */
export function isEnvFile(path: string): boolean {
  const name = basename(path);
  return /^\.env(\..+)?$/.test(name) && name !== ".env.example";
}

const ENV_IN_COMMAND = /(?:^|[\s'"=/<>:;|&(`])(\.env(?:[.*?[{][\w.*?[\]{},-]*)?)(?=$|[\s'"/;|&)<>`])/g;

/** Comando cita `.env` (ou glob que o alcança) como palavra ou fim de caminho; `.env.example` é permitido. */
export function mentionsEnv(command: string): boolean {
  for (const match of command.matchAll(ENV_IN_COMMAND)) {
    if (match[1] !== ".env.example") return true;
  }
  return false;
}

/** Divide o comando em palavras (respeitando aspas) e operadores de controle. */
export function shellWords(command: string): string[] {
  const words: string[] = [];
  let current = "";
  let has = false;
  let quote: "'" | '"' | undefined;
  const push = (): void => {
    if (has) words.push(current);
    current = "";
    has = false;
  };
  for (let i = 0; i < command.length; i += 1) {
    const ch = command.charAt(i);
    if (quote !== undefined) {
      if (ch === quote) quote = undefined;
      else if (ch === "\\" && quote === '"' && i + 1 < command.length) {
        i += 1;
        current += command.charAt(i);
      } else current += ch;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      has = true;
    } else if (ch === "\\" && i + 1 < command.length) {
      i += 1;
      const next = command.charAt(i);
      if (next !== "\n") {
        current += next;
        has = true;
      }
    } else if (ch === " " || ch === "\t") push();
    else if ("\n;|&()".includes(ch)) {
      push();
      const two = command.slice(i, i + 2);
      if (two === "&&" || two === "||") {
        words.push(two);
        i += 1;
      } else words.push(ch);
    } else {
      current += ch;
      has = true;
    }
  }
  push();
  return words;
}

function segments(words: readonly string[]): string[][] {
  const out: string[][] = [[]];
  for (const word of words) {
    if (SEPARATORS.has(word)) out.push([]);
    else out.at(-1)?.push(word);
  }
  return out.filter((segment) => segment.length > 0);
}

/** `-n` em `git commit`, inclusive agrupado (`-an`, `-anm msg`), sem confundir com valor de `-m`. */
function commitSkipsHooks(args: readonly string[]): boolean {
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i] ?? "";
    if (arg === "--") return false;
    if (!/^-[^-]/.test(arg)) continue;
    for (let j = 1; j < arg.length; j += 1) {
      const flag = arg.charAt(j);
      if (flag === "n") return true;
      if (COMMIT_VALUE_FLAGS.has(flag)) {
        if (j === arg.length - 1 && flag !== "S" && flag !== "u") i += 1;
        break;
      }
    }
  }
  return false;
}

function gitSkipsHooks(segment: readonly string[]): boolean {
  const gitAt = segment.findIndex((word) => word === "git" || word.endsWith("/git"));
  if (gitAt < 0) return false;
  let i = gitAt + 1;
  while (i < segment.length) {
    const word = segment[i] ?? "";
    if (GIT_GLOBAL_VALUE_FLAGS.has(word)) i += 2;
    else if (word.startsWith("-")) i += 1;
    else break;
  }
  return segment[i] === "commit" && commitSkipsHooks(segment.slice(i + 1));
}

export function checkBash(command: string): Decision {
  if (/--no-veri(?:fy?)?(?![\w-])/.test(command))
    return deny("--no-verify é proibido: corrija a causa da falha do hook");
  if (/core\.hookspath/i.test(command)) return deny("trocar core.hooksPath desliga os hooks do git: proibido");
  if (/\bLEFTHOOK(?:_EXCLUDE)?=/.test(command)) return deny("desligar o lefthook por variável é proibido");
  if (segments(shellWords(command)).some(gitSkipsHooks)) {
    return deny("git commit -n pula os hooks (equivale a --no-verify): proibido");
  }
  if (mentionsEnv(command)) return deny(".env não pode ser lido nem alterado (use .env.example)");
  return ALLOW;
}

/** Caminho real (segue symlink do maior prefixo existente). */
function realPath(path: string): string {
  let existing = path;
  const rest: string[] = [];
  while (!existsSync(existing)) {
    const parent = dirname(existing);
    if (parent === existing) break;
    rest.unshift(basename(existing));
    existing = parent;
  }
  return resolve(realpathSync(existing), ...rest);
}

export function isInside(root: string, path: string): boolean {
  const rel = relative(realPath(root), realPath(path));
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

function stringField(input: Readonly<Record<string, unknown>>, key: string): string | undefined {
  const value = input[key];
  return typeof value === "string" ? value : undefined;
}

export function decide(input: HookInput, projectDir: string): Decision {
  const { toolName, toolInput, cwd } = input;
  if (toolName === "Bash") return checkBash(stringField(toolInput, "command") ?? "");
  for (const key of PATH_KEYS) {
    const raw = stringField(toolInput, key);
    if (raw === undefined) continue;
    const path = resolve(cwd, raw);
    if (isEnvFile(path)) return deny(".env não pode ser lido nem alterado (use .env.example)");
    if (WRITE_TOOLS.has(toolName) && !isInside(projectDir, path)) {
      return deny(`escrita fora do repositório: ${path}`);
    }
  }
  const glob = toolName === "Glob" ? stringField(toolInput, "pattern") : stringField(toolInput, "glob");
  if ((toolName === "Glob" || toolName === "Grep") && mentionsEnv(glob ?? "")) {
    return deny(".env não pode ser lido nem listado (use .env.example)");
  }
  return ALLOW;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseInput(text: string, fallbackCwd: string): HookInput | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (!isRecord(parsed)) return undefined;
  const toolName = parsed["tool_name"];
  const toolInput = parsed["tool_input"];
  const cwd = parsed["cwd"];
  if (typeof toolName !== "string" || !isRecord(toolInput)) return undefined;
  return { toolName, toolInput, cwd: typeof cwd === "string" ? cwd : fallbackCwd };
}

export function run(stdin: string, projectDir: string): { code: number; message: string } {
  const input = parseInput(stdin, projectDir);
  if (input === undefined) return { code: 2, message: "guard-hook: evento inválido no stdin; bloqueado" };
  const decision = decide(input, projectDir);
  return decision.allow ? { code: 0, message: "" } : { code: 2, message: `guard-hook: ${decision.reason}` };
}

if (import.meta.main) {
  const projectDir = process.env["CLAUDE_PROJECT_DIR"] ?? resolve(import.meta.dirname, "..");
  let stdin = "";
  try {
    stdin = readFileSync(0, "utf8");
  } catch {
    stdin = "";
  }
  const { code, message } = run(stdin, projectDir);
  if (message !== "") process.stderr.write(`${message}\n`);
  process.exitCode = code;
}
