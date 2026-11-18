// Gates do workflow de feature (../harness-ada/workflow/feature.md). Uso: pnpm gate <nome> <feature> [--sign]
// Lê e grava docs/plano/<feature>/estado.json. Só responde PASS ou FAIL; teste pulado, 0/0 ou relatório
// ausente é FAIL. A mensagem de FAIL diz o que falta.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

export interface RunResult {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

export type Runner = (cmd: string, args: readonly string[], cwd: string) => RunResult;

export type GateName = "expect-red" | "tests-reviewed" | "coverage";

export interface GateOutcome {
  readonly gate: GateName;
  readonly pass: boolean;
  readonly detail: string;
  readonly problems: readonly string[];
}

export interface GateOptions {
  readonly root: string;
  readonly feature: string;
  readonly run: Runner;
  readonly sign?: boolean;
  readonly now?: () => Date;
}

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type JsonObject = { [key: string]: Json };

export const GATE_NAMES: readonly GateName[] = ["expect-red", "tests-reviewed", "coverage"];

export const spawnRunner: Runner = (cmd, args, cwd) => {
  const result = spawnSync(cmd, [...args], { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
};

export function isGateName(value: string): value is GateName {
  return GATE_NAMES.some((name) => name === value);
}

function isJsonObject(value: Json | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isJson(value: unknown): value is Json {
  if (value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
    return true;
  }
  if (Array.isArray(value)) return value.every((item: unknown) => isJson(item));
  if (typeof value === "object") return Object.values(value).every((item: unknown) => isJson(item));
  return false;
}

function parseJson(text: string): Json {
  const parsed: unknown = JSON.parse(text);
  if (!isJson(parsed)) throw new GateError(["JSON inválido"]);
  return parsed;
}

function numberAt(obj: JsonObject, key: string): number {
  const value = obj[key];
  return typeof value === "number" ? value : 0;
}

function objectAt(obj: JsonObject, key: string): JsonObject | undefined {
  const value = obj[key];
  return isJsonObject(value) ? value : undefined;
}

function lastLines(text: string, count: number): string {
  return text.trim().split("\n").slice(-count).join("\n");
}

export function statePath(root: string, feature: string): string {
  return join(root, "docs", "plano", feature, "estado.json");
}

export function readState(root: string, feature: string): JsonObject {
  const file = statePath(root, feature);
  if (!existsSync(file)) {
    throw new GateError([`falta ${relative(root, file)}: o orquestrador cria o estado na etapa plan`]);
  }
  const state = parseJson(readFileSync(file, "utf8"));
  if (!isJsonObject(state)) throw new GateError([`${relative(root, file)} não é um objeto JSON`]);
  return state;
}

function writeState(root: string, feature: string, state: JsonObject): void {
  writeFileSync(statePath(root, feature), `${JSON.stringify(state, null, 2)}\n`);
}

export class GateError extends Error {
  readonly problems: readonly string[];
  constructor(problems: readonly string[]) {
    super(problems.join("; "));
    this.problems = problems;
  }
}

/** Arquivos de teste da feature: `tests` do estado; se faltar, as chaves de `testShas`. */
export function testFiles(state: JsonObject): string[] {
  const tests = state["tests"];
  if (Array.isArray(tests)) {
    const files = tests.filter((item): item is string => typeof item === "string" && item.length > 0);
    if (files.length !== tests.length) throw new GateError(["`tests` do estado deve ser uma lista de caminhos"]);
    if (files.length > 0) return files;
  }
  const shas = objectAt(state, "testShas");
  const fromShas = shas === undefined ? [] : Object.keys(shas);
  if (fromShas.length === 0) {
    throw new GateError(["estado sem `tests`: liste os arquivos de teste da feature (caminhos relativos à raiz)"]);
  }
  return fromShas;
}

function checkFilesExist(root: string, files: readonly string[]): void {
  const problems: string[] = [];
  for (const file of files) {
    if (isAbsolute(file) || file.split(/[\\/]/).includes("..")) {
      problems.push(`${file}: use caminho relativo à raiz, sem ".."`);
    } else if (!existsSync(join(root, file))) {
      problems.push(`${file}: arquivo de teste não existe`);
    }
  }
  if (problems.length > 0) throw new GateError(problems);
}

/** Pasta do pacote do teste: o diretório mais próximo com package.json, abaixo da raiz. */
export function packageOf(root: string, file: string): string {
  let dir = dirname(resolve(root, file));
  const top = resolve(root);
  while (dir.startsWith(top + sep)) {
    if (existsSync(join(dir, "package.json"))) return dir;
    dir = dirname(dir);
  }
  throw new GateError([`${file}: nenhum package.json entre o teste e a raiz (teste fora de pacote)`]);
}

export function groupByPackage(root: string, files: readonly string[]): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const file of files) {
    const pkg = packageOf(root, file);
    const list = groups.get(pkg) ?? [];
    list.push(relative(pkg, resolve(root, file)));
    groups.set(pkg, list);
  }
  return groups;
}

interface VitestFile {
  readonly name: string;
  readonly assertions: readonly string[];
}

interface VitestReport {
  readonly total: number;
  readonly passed: number;
  readonly failed: number;
  readonly pending: number;
  readonly todo: number;
  readonly files: readonly VitestFile[];
}

export function parseVitestReport(text: string): VitestReport {
  const report = parseJson(text);
  if (!isJsonObject(report)) throw new GateError(["relatório do vitest ilegível"]);
  const results = report["testResults"];
  const files: VitestFile[] = [];
  if (Array.isArray(results)) {
    for (const item of results) {
      if (!isJsonObject(item)) continue;
      const name = item["name"];
      const assertions = item["assertionResults"];
      files.push({
        name: typeof name === "string" ? name : "",
        assertions: Array.isArray(assertions)
          ? assertions.map((a) => (isJsonObject(a) && typeof a["status"] === "string" ? a["status"] : "unknown"))
          : [],
      });
    }
  }
  return {
    total: numberAt(report, "numTotalTests"),
    passed: numberAt(report, "numPassedTests"),
    failed: numberAt(report, "numFailedTests"),
    pending: numberAt(report, "numPendingTests"),
    todo: numberAt(report, "numTodoTests"),
    files,
  };
}

function withTempDir<T>(body: (dir: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), "pilla-gate-"));
  try {
    return body(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function readReport(file: string, run: RunResult, pkgLabel: string): VitestReport {
  if (!existsSync(file)) {
    throw new GateError([
      `${pkgLabel}: o vitest não gerou relatório (erro de configuração ou import?)\n${lastLines(run.stderr, 15)}`,
    ]);
  }
  return parseVitestReport(readFileSync(file, "utf8"));
}

function skipProblems(report: VitestReport, pkgLabel: string): string[] {
  const skipped = report.pending + report.todo;
  return skipped > 0 ? [`${pkgLabel}: ${String(skipped)} teste(s) pulado(s) ou todo; pular é FAIL`] : [];
}

function fileEntry(report: VitestReport, pkg: string, file: string): VitestFile | undefined {
  const target = resolve(pkg, file);
  return report.files.find((entry) => resolve(pkg, entry.name) === target);
}

function expectRed(opts: GateOptions, files: readonly string[]): GateOutcome {
  const problems: string[] = [];
  let total = 0;
  for (const [pkg, pkgFiles] of groupByPackage(opts.root, files)) {
    const label = relative(opts.root, pkg);
    withTempDir((dir) => {
      const out = join(dir, "report.json");
      const run = opts.run(
        "pnpm",
        ["exec", "vitest", "run", ...pkgFiles, "--reporter=json", `--outputFile=${out}`, "--coverage.enabled=false"],
        pkg,
      );
      const report = readReport(out, run, label);
      total += report.total;
      problems.push(...skipProblems(report, label));
      for (const file of pkgFiles) {
        const entry = fileEntry(report, pkg, file);
        const where = join(label, file);
        if (entry === undefined || entry.assertions.length === 0) {
          problems.push(`${where}: nenhum teste executado (erro de import ou sintaxe?)`);
          continue;
        }
        const passed = entry.assertions.filter((status) => status === "passed").length;
        if (passed > 0) {
          problems.push(`${where}: ${String(passed)} teste(s) passaram sem implementação (teste que não testa nada)`);
        }
      }
    });
  }
  return problems.length > 0
    ? { gate: "expect-red", pass: false, detail: "testes não estão vermelhos", problems }
    : { gate: "expect-red", pass: true, detail: `${String(total)} teste(s), todos falhando`, problems: [] };
}

export function hashObject(opts: GateOptions, file: string): string {
  const run = opts.run("git", ["hash-object", file], opts.root);
  const sha = run.stdout.trim();
  if (run.status !== 0 || !/^[0-9a-f]{40,64}$/.test(sha)) {
    throw new GateError([`${file}: git hash-object falhou (${lastLines(run.stderr, 3)})`]);
  }
  return sha;
}

function gateStatus(state: JsonObject, gate: GateName): string | undefined {
  const gates = objectAt(state, "gates");
  const entry = gates === undefined ? undefined : objectAt(gates, gate);
  const status = entry?.["status"];
  return typeof status === "string" ? status : undefined;
}

function testsReviewed(opts: GateOptions, state: JsonObject, files: readonly string[]): GateOutcome {
  if (opts.sign === true) {
    if (gateStatus(state, "expect-red") !== "PASS") {
      return {
        gate: "tests-reviewed",
        pass: false,
        detail: "assinatura recusada",
        problems: ["rode `pnpm gate expect-red <feature>` com PASS antes de assinar a revisão"],
      };
    }
    const shas: JsonObject = {};
    for (const file of files) shas[file] = hashObject(opts, file);
    state["testShas"] = shas;
    return { gate: "tests-reviewed", pass: true, detail: `${String(files.length)} teste(s) assinado(s)`, problems: [] };
  }
  const signed = objectAt(state, "testShas");
  if (signed === undefined || Object.keys(signed).length === 0) {
    return {
      gate: "tests-reviewed",
      pass: false,
      detail: "testes sem revisão assinada",
      problems: [
        "estado sem `testShas`: após a aprovação do reviewer rode `pnpm gate tests-reviewed <feature> --sign`",
      ],
    };
  }
  const problems: string[] = [];
  for (const file of files) {
    const expected = signed[file];
    if (typeof expected !== "string") {
      problems.push(`${file}: sem sha assinado (teste novo precisa de revisão e --sign)`);
    } else if (hashObject(opts, file) !== expected) {
      problems.push(`${file}: mudou depois da revisão (volte à revisão dos testes)`);
    }
  }
  for (const file of Object.keys(signed)) {
    if (!files.includes(file)) problems.push(`${file}: assinado mas fora de \`tests\` do estado`);
  }
  return problems.length > 0
    ? { gate: "tests-reviewed", pass: false, detail: "revisão dos testes caiu", problems }
    : { gate: "tests-reviewed", pass: true, detail: `${String(files.length)} teste(s) com sha assinado`, problems: [] };
}

const METRICS = ["lines", "branches", "functions", "statements"] as const;

/** Arquivo de produção medido por um teste: o mesmo caminho sem o `.test` (lib/a.test.ts → lib/a.ts). */
export function productionFile(testFile: string): string | undefined {
  const match = /^(.*)\.test(\.[^./\\]+)$/.exec(testFile);
  return match === null ? undefined : `${match[1] ?? ""}${match[2] ?? ""}`;
}

/** Escapa os caracteres de glob para o `--coverage.include` casar só aquele arquivo (ex.: app/(admin)/...). */
function literalGlob(file: string): string {
  return file
    .split(sep)
    .join("/")
    .replace(/[\\()[\]{}*?!+@]/g, "\\$&");
}

function fileCoverage(summary: Json, pkg: string, file: string, where: string): string[] {
  const entry = isJsonObject(summary) ? objectAt(summary, resolve(pkg, file)) : undefined;
  if (entry === undefined) {
    return [`${where}: fora do relatório de cobertura (excluído ou não carregado pelos testes)`];
  }
  const lines = objectAt(entry, "lines");
  if (lines === undefined || numberAt(lines, "total") === 0) return [`${where}: cobertura vazia (0/0 linhas)`];
  const missing: string[] = [];
  for (const metric of METRICS) {
    const data = objectAt(entry, metric);
    const total = data === undefined ? -1 : numberAt(data, "total");
    const covered = data === undefined ? 0 : numberAt(data, "covered");
    if (covered !== total) missing.push(`${metric} ${String(covered)}/${String(total)}`);
  }
  return missing.length > 0 ? [`${where}: cobertura abaixo de 100% (${missing.join(", ")})`] : [];
}

function coverageOfFiles(summaryFile: string, pkg: string, label: string, prodFiles: readonly string[]): string[] {
  if (!existsSync(summaryFile)) return [`${label}: cobertura não gerada (coverage-summary.json ausente)`];
  const summary = parseJson(readFileSync(summaryFile, "utf8"));
  return prodFiles.flatMap((file) => fileCoverage(summary, pkg, file, join(label, file)));
}

/** Arquivos de produção da feature no pacote; os que faltam ou não seguem o padrão viram problema. */
function productionFiles(
  pkg: string,
  label: string,
  testFilesOfPkg: readonly string[],
): {
  files: string[];
  problems: string[];
} {
  const files: string[] = [];
  const problems: string[] = [];
  for (const test of testFilesOfPkg) {
    const prod = productionFile(test);
    if (prod === undefined) problems.push(`${join(label, test)}: nome sem ".test.<ext>"; não há arquivo de produção`);
    else if (!existsSync(join(pkg, prod))) problems.push(`${join(label, prod)}: arquivo de produção não existe`);
    else if (!files.includes(prod)) files.push(prod);
  }
  return { files, problems };
}

/**
 * Cobertura da feature: roda só os testes de `tests` do estado e mede só os arquivos de produção deles
 * (cada teste sem o `.test`), exigindo 100% de linhas, ramos, funções e statements. O `coverage.exclude`
 * do vitest.config é anulado para um arquivo da feature não sumir da medição; se mesmo assim ele faltar
 * no relatório, é FAIL. A suíte inteira do pacote é do `pnpm verify`.
 */
function coverage(opts: GateOptions, files: readonly string[]): GateOutcome {
  const problems: string[] = [];
  const done: string[] = [];
  for (const [pkg, pkgFiles] of groupByPackage(opts.root, files)) {
    const label = relative(opts.root, pkg);
    const prod = productionFiles(pkg, label, pkgFiles);
    if (prod.problems.length > 0) {
      problems.push(...prod.problems);
      continue;
    }
    withTempDir((dir) => {
      const out = join(dir, "report.json");
      const covDir = join(dir, "coverage");
      const run = opts.run(
        "pnpm",
        [
          "exec",
          "vitest",
          "run",
          ...pkgFiles,
          "--coverage.enabled=true",
          "--coverage.reporter=json-summary",
          `--coverage.reportsDirectory=${covDir}`,
          ...prod.files.map((file) => `--coverage.include=${literalGlob(file)}`),
          "--coverage.exclude=",
          ...METRICS.map((metric) => `--coverage.thresholds.${metric}=100`),
          "--reporter=json",
          `--outputFile=${out}`,
        ],
        pkg,
      );
      const report = readReport(out, run, label);
      const pkgProblems: string[] = [];
      if (report.total === 0) pkgProblems.push(`${label}: nenhum teste executado`);
      if (report.failed > 0) pkgProblems.push(`${label}: ${String(report.failed)} teste(s) falhando`);
      pkgProblems.push(...skipProblems(report, label));
      for (const file of pkgFiles) {
        const entry = fileEntry(report, pkg, file);
        if (entry === undefined || entry.assertions.length === 0) {
          pkgProblems.push(`${join(label, file)}: teste da feature não rodou (fora do relatório do vitest)`);
        }
      }
      pkgProblems.push(...coverageOfFiles(join(covDir, "coverage-summary.json"), pkg, label, prod.files));
      if (run.status !== 0 && pkgProblems.length === 0) {
        pkgProblems.push(
          `${label}: vitest saiu com código ${String(run.status)} (limite de cobertura?)\n${lastLines(run.stderr, 15)}`,
        );
      }
      problems.push(...pkgProblems);
      if (pkgProblems.length === 0) done.push(`${label} (${prod.files.join(", ")})`);
    });
  }
  return problems.length > 0
    ? { gate: "coverage", pass: false, detail: "cobertura da feature não atendida", problems }
    : { gate: "coverage", pass: true, detail: `100% nos arquivos da feature em ${done.join("; ")}`, problems: [] };
}

function record(state: JsonObject, outcome: GateOutcome, now: Date): void {
  const gates = objectAt(state, "gates") ?? {};
  const detail = outcome.pass ? outcome.detail : [outcome.detail, ...outcome.problems].join("; ");
  gates[outcome.gate] = { status: outcome.pass ? "PASS" : "FAIL", at: now.toISOString(), detail };
  state["gates"] = gates;
}

/** Roda o gate, grava o resultado no estado (quando ele existe) e devolve PASS/FAIL. */
export function runGate(gate: GateName, opts: GateOptions): GateOutcome {
  let state: JsonObject;
  try {
    state = readState(opts.root, opts.feature);
  } catch (error) {
    if (error instanceof GateError) return { gate, pass: false, detail: "estado ausente", problems: error.problems };
    throw error;
  }
  let outcome: GateOutcome;
  try {
    const files = testFiles(state);
    checkFilesExist(opts.root, files);
    if (gate === "expect-red") outcome = expectRed(opts, files);
    else if (gate === "tests-reviewed") outcome = testsReviewed(opts, state, files);
    else outcome = coverage(opts, files);
  } catch (error) {
    if (!(error instanceof GateError)) throw error;
    outcome = { gate, pass: false, detail: "pré-condição", problems: error.problems };
  }
  record(state, outcome, (opts.now ?? (() => new Date()))());
  writeState(opts.root, opts.feature, state);
  return outcome;
}

export function formatOutcome(outcome: GateOutcome, feature: string): string {
  const head = `${outcome.pass ? "PASS" : "FAIL"} ${outcome.gate} ${feature}: ${outcome.detail}`;
  return [head, ...outcome.problems.map((problem) => `  - ${problem}`)].join("\n");
}

const USAGE = `uso: pnpm gate <${GATE_NAMES.join("|")}> <feature> [--sign]`;

export function main(argv: readonly string[], root: string, run: Runner): { code: number; output: string } {
  const flags = argv.filter((arg) => arg.startsWith("--"));
  const [gate, feature, ...extra] = argv.filter((arg) => !arg.startsWith("--"));
  const badFlags = flags.filter((flag) => flag !== "--sign");
  if (gate === undefined || feature === undefined || extra.length > 0 || badFlags.length > 0) {
    return { code: 2, output: USAGE };
  }
  if (!isGateName(gate)) return { code: 2, output: `gate desconhecido: ${gate}\n${USAGE}` };
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(feature)) return { code: 2, output: `feature inválida: ${feature}` };
  const sign = flags.includes("--sign");
  if (sign && gate !== "tests-reviewed") return { code: 2, output: `--sign só vale para tests-reviewed\n${USAGE}` };
  const outcome = runGate(gate, { root, feature, run, sign });
  return { code: outcome.pass ? 0 : 1, output: formatOutcome(outcome, feature) };
}

if (import.meta.main) {
  const { code, output } = main(process.argv.slice(2), resolve(import.meta.dirname, ".."), spawnRunner);
  (code === 0 ? process.stdout : process.stderr).write(`${output}\n`);
  process.exitCode = code;
}
