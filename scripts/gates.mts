// Gates do workflow de feature (../harness-ada/workflow/feature.md). Uso: pnpm gate <nome> <feature> [--sign]
// Lê e grava docs/plano/<feature>/estado.json. Só responde PASS ou FAIL; teste pulado, 0/0 ou relatório
// ausente é FAIL. A mensagem de FAIL diz o que falta. Ferramenta e score mínimo de mutação e e2e vêm do bloco
// `gates:` do harness.project.yaml.
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

export type GateName = "expect-red" | "tests-reviewed" | "coverage" | "mutation" | "e2e";

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

export const GATE_NAMES: readonly GateName[] = ["expect-red", "tests-reviewed", "coverage", "mutation", "e2e"];

type Layer = "unit" | "prop" | "e2e" | "mut";

const LAYERS: readonly Layer[] = ["unit", "prop", "e2e", "mut"];

interface Criterion {
  readonly id: string;
  readonly camadas: readonly Layer[];
}

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
    const bad = checkRelative(file);
    if (bad !== undefined) {
      problems.push(bad);
    } else if (!existsSync(join(root, file))) {
      problems.push(`${file}: arquivo de teste não existe`);
    }
  }
  if (problems.length > 0) throw new GateError(problems);
}

/** Lista de caminhos do estado em `key`; `undefined` quando a chave falta. */
export function stringList(state: JsonObject, key: string): string[] | undefined {
  const value = state[key];
  if (value === undefined) return undefined;
  const list = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
  if (!Array.isArray(value) || list.length !== value.length) {
    throw new GateError([`\`${key}\` do estado deve ser uma lista de caminhos`]);
  }
  return list;
}

function unique(files: readonly string[]): string[] {
  return [...new Set(files)];
}

function isLayer(value: Json | undefined): value is Layer {
  return typeof value === "string" && LAYERS.some((layer) => layer === value);
}

function stringAt(obj: JsonObject, key: string): string | undefined {
  const value = obj[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/** Critérios do estado (`A<n>` → camadas). Critério malformado vira problema. */
export function criteriaOf(state: JsonObject): { criteria: Criterion[]; problems: string[] } {
  const value = state["criteria"];
  if (!Array.isArray(value) || value.length === 0) {
    return {
      criteria: [],
      problems: ["estado sem `criteria`: liste os critérios A<n> com as camadas (unit|prop|e2e|mut)"],
    };
  }
  const criteria: Criterion[] = [];
  const problems: string[] = [];
  value.forEach((item, index) => {
    const id = isJsonObject(item) ? stringAt(item, "id") : undefined;
    const layers = isJsonObject(item) ? item["camadas"] : undefined;
    const where = id ?? `criteria[${String(index)}]`;
    if (id === undefined) problems.push(`${where}: critério sem \`id\``);
    if (!Array.isArray(layers) || layers.length === 0) {
      problems.push(`${where}: \`camadas\` vazia ou ausente`);
    } else if (!layers.every((layer) => isLayer(layer))) {
      problems.push(`${where}: camada inválida (use unit, prop, e2e ou mut)`);
    } else if (id !== undefined) {
      criteria.push({ id, camadas: layers.filter((layer) => isLayer(layer)) });
    }
  });
  return { criteria, problems };
}

interface Scenario {
  readonly id: string;
  readonly criterio: string | undefined;
  readonly camada: string | undefined;
  readonly arquivo: string | undefined;
  readonly teste: string | undefined;
}

function scenariosOf(state: JsonObject): Scenario[] {
  const value = state["scenarios"];
  if (!Array.isArray(value)) return [];
  return value.filter(isJsonObject).map((item, index) => ({
    id: stringAt(item, "id") ?? `scenarios[${String(index)}]`,
    criterio: stringAt(item, "criterio"),
    camada: stringAt(item, "camada"),
    arquivo: stringAt(item, "arquivo"),
    teste: stringAt(item, "teste"),
  }));
}

function layerFiles(layer: string, tests: readonly string[], e2e: readonly string[]): readonly string[] {
  return layer === "e2e" ? e2e : tests;
}

function listName(layer: string): string {
  return layer === "e2e" ? "`e2e`" : "`tests`";
}

/**
 * Camadas dos critérios: cada critério, em cada camada unit/prop/e2e, precisa de um scenario daquela camada
 * cujo arquivo está em `tests` (unit/prop) ou em `e2e` (e2e). A camada mut é medida pelo gate mutation.
 */
export function layerProblems(state: JsonObject, tests: readonly string[], e2e: readonly string[]): string[] {
  const { criteria, problems } = criteriaOf(state);
  const ids = criteria.map((criterion) => criterion.id);
  const scenarios = scenariosOf(state);
  for (const scenario of scenarios) {
    const where = `${scenario.id}${scenario.teste === undefined ? "" : ` (${scenario.teste})`}`;
    if (scenario.camada === undefined) problems.push(`${where}: scenario sem \`camada\``);
    else if (!["unit", "prop", "e2e"].includes(scenario.camada)) {
      problems.push(`${where}: camada "${scenario.camada}" inválida no scenario (use unit, prop ou e2e)`);
    }
    if (scenario.criterio === undefined || !ids.includes(scenario.criterio)) {
      problems.push(`${where}: critério "${scenario.criterio ?? ""}" fora de \`criteria\``);
    }
    if (scenario.camada !== undefined) {
      const files = layerFiles(scenario.camada, tests, e2e);
      if (scenario.arquivo === undefined || !files.includes(scenario.arquivo)) {
        problems.push(`${where}: arquivo "${scenario.arquivo ?? ""}" fora de ${listName(scenario.camada)}`);
      }
    }
  }
  for (const criterion of criteria) {
    for (const layer of criterion.camadas) {
      if (layer === "mut") continue;
      const files = layerFiles(layer, tests, e2e);
      const covered = scenarios.some(
        (s) =>
          s.criterio === criterion.id && s.camada === layer && s.arquivo !== undefined && files.includes(s.arquivo),
      );
      if (!covered) problems.push(`${criterion.id}: sem scenario da camada ${layer} com arquivo em ${listName(layer)}`);
    }
  }
  return problems;
}

export type GateConfig = Readonly<Record<string, string | number>>;

/** Bloco `gates:` do harness.project.yaml (uma linha `nome: { chave: valor, ... }` por gate). */
export function readProjectGates(root: string): Map<string, GateConfig> {
  const configs = new Map<string, GateConfig>();
  const file = join(root, "harness.project.yaml");
  if (!existsSync(file)) return configs;
  const lines = readFileSync(file, "utf8").split("\n");
  const start = lines.findIndex((line) => /^gates:\s*(#.*)?$/.test(line));
  if (start < 0) return configs;
  for (const line of lines.slice(start + 1)) {
    if (line.trim() === "" || /^\s+#/.test(line)) continue;
    if (!/^\s/.test(line)) break;
    const match = /^\s+([\w-]+):\s*\{(.*)\}\s*(#.*)?$/.exec(line);
    if (match === null) continue;
    const config: Record<string, string | number> = {};
    for (const pair of (match[2] ?? "").split(",")) {
      const [key, ...rest] = pair.split(":");
      const name = key?.trim() ?? "";
      const raw = rest.join(":").trim();
      if (name === "" || raw === "") continue;
      config[name] = /^-?\d+(\.\d+)?$/.test(raw) ? Number(raw) : raw;
    }
    configs.set(match[1] ?? "", config);
  }
  return configs;
}

function checkRelative(file: string): string | undefined {
  return isAbsolute(file) || file.split(/[\\/]/).includes("..")
    ? `${file}: use caminho relativo à raiz, sem ".."`
    : undefined;
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

/**
 * Revisão dos testes: confere as camadas dos critérios e os shas assinados de `tests` mais `e2e`.
 * Com `--sign` (só depois de expect-red PASS) grava os shas de todos esses arquivos.
 */
function testsReviewed(opts: GateOptions, state: JsonObject, tests: readonly string[]): GateOutcome {
  const e2e = stringList(state, "e2e") ?? [];
  checkFilesExist(opts.root, e2e);
  const layers = layerProblems(state, tests, e2e);
  if (layers.length > 0) {
    return { gate: "tests-reviewed", pass: false, detail: "camadas dos critérios não fecham", problems: layers };
  }
  const files = unique([...tests, ...e2e]);
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
    if (!files.includes(file)) problems.push(`${file}: assinado mas fora de \`tests\` e \`e2e\` do estado`);
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

/** Suíte da feature: `tests` mais `regressionTests` (que precisam existir). */
function featureSuite(root: string, state: JsonObject, tests: readonly string[]): string[] {
  const regression = stringList(state, "regressionTests") ?? [];
  checkFilesExist(root, regression);
  return unique([...tests, ...regression]);
}

/** Valida `sources` (ou `domainSources`): caminho relativo, arquivo existente e pacote com testes da feature. */
function sourcesByPackage(
  root: string,
  sources: readonly string[],
  suiteGroups: ReadonlyMap<string, readonly string[]>,
  key: string,
): { groups: Map<string, string[]>; problems: string[] } {
  const groups = new Map<string, string[]>();
  const problems: string[] = [];
  if (sources.length === 0) return { groups, problems: [`\`${key}\` vazio: liste os arquivos de produção da feature`] };
  for (const file of sources) {
    const bad = checkRelative(file);
    if (bad !== undefined) {
      problems.push(bad);
      continue;
    }
    if (!existsSync(join(root, file))) {
      problems.push(`${file}: arquivo de \`${key}\` não existe`);
      continue;
    }
    const pkg = packageOf(root, file);
    if (!suiteGroups.has(pkg)) {
      problems.push(`${file}: fora de um pacote com testes da feature (${relative(root, pkg) || "."})`);
      continue;
    }
    const list = groups.get(pkg) ?? [];
    list.push(relative(pkg, resolve(root, file)));
    groups.set(pkg, list);
  }
  return { groups, problems };
}

/** Arquivos medidos por pacote: `sources` do estado; sem `sources`, a regra do nome sobre `tests`. */
function measuredFiles(
  opts: GateOptions,
  state: JsonObject,
  tests: readonly string[],
  suiteGroups: ReadonlyMap<string, readonly string[]>,
): { groups: Map<string, string[]>; problems: string[] } {
  const sources = stringList(state, "sources");
  if (sources !== undefined) return sourcesByPackage(opts.root, sources, suiteGroups, "sources");
  const groups = new Map<string, string[]>();
  const problems: string[] = [];
  for (const [pkg, pkgTests] of groupByPackage(opts.root, tests)) {
    const prod = productionFiles(pkg, relative(opts.root, pkg), pkgTests);
    problems.push(...prod.problems);
    groups.set(pkg, prod.files);
  }
  return { groups, problems };
}

function coverageOfPackage(
  opts: GateOptions,
  pkg: string,
  pkgFiles: readonly string[],
  prod: readonly string[],
): string[] {
  const label = relative(opts.root, pkg);
  return withTempDir((dir) => {
    const out = join(dir, "report.json");
    const covDir = join(dir, "coverage");
    const coverageArgs =
      prod.length === 0
        ? ["--coverage.enabled=false"]
        : [
            "--coverage.enabled=true",
            "--coverage.reporter=json-summary",
            `--coverage.reportsDirectory=${covDir}`,
            ...prod.map((file) => `--coverage.include=${literalGlob(file)}`),
            "--coverage.exclude=",
            ...METRICS.map((metric) => `--coverage.thresholds.${metric}=100`),
          ];
    const run = opts.run(
      "pnpm",
      ["exec", "vitest", "run", ...pkgFiles, ...coverageArgs, "--reporter=json", `--outputFile=${out}`],
      pkg,
    );
    const report = readReport(out, run, label);
    const problems: string[] = [];
    if (report.total === 0) problems.push(`${label}: nenhum teste executado`);
    if (report.failed > 0) problems.push(`${label}: ${String(report.failed)} teste(s) falhando`);
    problems.push(...skipProblems(report, label));
    for (const file of pkgFiles) {
      const entry = fileEntry(report, pkg, file);
      if (entry === undefined || entry.assertions.length === 0) {
        problems.push(`${join(label, file)}: teste da feature não rodou (fora do relatório do vitest)`);
      }
    }
    if (prod.length > 0) problems.push(...coverageOfFiles(join(covDir, "coverage-summary.json"), pkg, label, prod));
    if (run.status !== 0 && problems.length === 0) {
      problems.push(
        `${label}: vitest saiu com código ${String(run.status)} (limite de cobertura?)\n${lastLines(run.stderr, 15)}`,
      );
    }
    return problems;
  });
}

/**
 * Cobertura da feature: roda a suíte (`tests` mais `regressionTests`) e mede os `sources` do estado (sem
 * `sources`, cada teste de `tests` sem o `.test`), exigindo 100% de linhas, ramos, funções e statements.
 * O `coverage.exclude` do vitest.config é anulado para um arquivo da feature não sumir da medição; se mesmo
 * assim ele faltar no relatório, é FAIL. A suíte inteira do pacote é do `pnpm verify`.
 */
function coverage(opts: GateOptions, state: JsonObject, tests: readonly string[]): GateOutcome {
  const suiteGroups = groupByPackage(opts.root, featureSuite(opts.root, state, tests));
  const measured = measuredFiles(opts, state, tests, suiteGroups);
  if (measured.problems.length > 0) {
    return { gate: "coverage", pass: false, detail: "cobertura da feature não atendida", problems: measured.problems };
  }
  const problems: string[] = [];
  const done: string[] = [];
  for (const [pkg, pkgFiles] of suiteGroups) {
    const prod = measured.groups.get(pkg) ?? [];
    const pkgProblems = coverageOfPackage(opts, pkg, pkgFiles, prod);
    problems.push(...pkgProblems);
    if (pkgProblems.length === 0 && prod.length > 0) done.push(`${relative(opts.root, pkg)} (${prod.join(", ")})`);
  }
  return problems.length > 0
    ? { gate: "coverage", pass: false, detail: "cobertura da feature não atendida", problems }
    : { gate: "coverage", pass: true, detail: `100% nos arquivos da feature em ${done.join("; ")}`, problems: [] };
}

interface MutantCount {
  readonly valid: number;
  readonly detected: number;
  readonly survivors: readonly string[];
}

/** Score de mutação = (Killed + Timeout) / (Killed + Timeout + Survived + NoCoverage). */
function countMutants(mutants: readonly Json[]): MutantCount {
  let detected = 0;
  let valid = 0;
  const survivors: string[] = [];
  for (const mutant of mutants) {
    if (!isJsonObject(mutant)) continue;
    const status = mutant["status"];
    if (status === "Killed" || status === "Timeout") {
      detected += 1;
      valid += 1;
    } else if (status === "Survived" || status === "NoCoverage") {
      valid += 1;
      const start = objectAt(objectAt(mutant, "location") ?? {}, "start");
      const line = start === undefined ? 0 : numberAt(start, "line");
      const mutator = typeof mutant["mutatorName"] === "string" ? mutant["mutatorName"] : "?";
      survivors.push(`L${String(line)} ${mutator}${status === "NoCoverage" ? " (sem cobertura)" : ""}`);
    }
  }
  return { valid, detected, survivors };
}

function mutationReportEntry(report: Json, pkg: string, file: string): readonly Json[] | undefined {
  const files = isJsonObject(report) ? objectAt(report, "files") : undefined;
  if (files === undefined) return undefined;
  const target = resolve(pkg, file);
  const key = Object.keys(files).find((name) => resolve(pkg, name) === target);
  const entry = key === undefined ? undefined : objectAt(files, key);
  const mutants = entry?.["mutants"];
  return Array.isArray(mutants) ? mutants : undefined;
}

/** Roda a suíte do pacote sem mutação: teste falhando, pulado ou ausente invalida o score. */
function suiteGreen(opts: GateOptions, pkg: string, label: string, suite: readonly string[]): string[] {
  return withTempDir((dir) => {
    const out = join(dir, "report.json");
    const run = opts.run(
      "pnpm",
      ["exec", "vitest", "run", ...suite, "--reporter=json", `--outputFile=${out}`, "--coverage.enabled=false"],
      pkg,
    );
    const report = readReport(out, run, label);
    const problems = skipProblems(report, label);
    if (report.total === 0) problems.push(`${label}: nenhum teste executado antes de mutar`);
    if (report.failed > 0 || (run.status !== 0 && problems.length === 0)) {
      problems.push(`${label}: teste falhando antes de mutar (${String(report.failed)} falha(s)); corrija antes`);
    }
    return problems;
  });
}

function mutationOfPackage(
  opts: GateOptions,
  pkg: string,
  files: readonly string[],
  suite: readonly string[],
  minScore: number,
): { problems: string[]; scores: string[] } {
  const label = relative(opts.root, pkg);
  const green = suiteGreen(opts, pkg, label, suite);
  if (green.length > 0) return { problems: green, scores: [] };
  return withTempDir((dir) => {
    const reportFile = join(dir, "mutation.json");
    const configFile = join(dir, "stryker.config.json");
    const config = {
      testRunner: "vitest",
      mutate: files,
      testFiles: suite,
      vitest: { related: false },
      reporters: ["json"],
      jsonReporter: { fileName: reportFile },
      tempDirName: ".stryker-tmp",
      plugins: ["@stryker-mutator/vitest-runner"],
      thresholds: { high: 100, low: minScore, break: null },
    };
    writeFileSync(configFile, JSON.stringify(config, null, 2));
    const run = opts.run("pnpm", ["exec", "stryker", "run", configFile], pkg);
    if (!existsSync(reportFile)) {
      const output = lastLines(`${run.stdout}\n${run.stderr}`, 15);
      return {
        problems: [`${label}: o stryker não gerou relatório (código ${String(run.status)})\n${output}`],
        scores: [],
      };
    }
    const report = parseJson(readFileSync(reportFile, "utf8"));
    const problems: string[] = [];
    const scores: string[] = [];
    for (const file of files) {
      const where = join(label, file);
      const mutants = mutationReportEntry(report, pkg, file);
      const count = countMutants(mutants ?? []);
      if (count.valid === 0) {
        problems.push(`${where}: 0 mutantes válidos (arquivo fora do relatório ou sem código mutável)`);
        continue;
      }
      const score = (count.detected / count.valid) * 100;
      const text = `${where} ${score.toFixed(2)}% (${String(count.detected)}/${String(count.valid)})`;
      const survivors = count.survivors.length > 0 ? `; sobreviventes: ${count.survivors.join(", ")}` : "";
      scores.push(`${text}${survivors}`);
      if (score < minScore) problems.push(`${text} < ${String(minScore)}%${survivors}`);
    }
    if (run.status !== 0 && problems.length === 0) {
      problems.push(`${label}: stryker saiu com código ${String(run.status)}\n${lastLines(run.stderr, 15)}`);
    }
    return { problems, scores };
  });
}

function fail(gate: GateName, detail: string, problems: readonly string[]): GateOutcome {
  return { gate, pass: false, detail, problems };
}

/**
 * Mutação nos `domainSources` com a ferramenta e o `min_score` de `gates.mutation` do harness.project.yaml.
 * A suíte é `tests` mais `regressionTests`; cada arquivo precisa de score maior ou igual ao mínimo.
 */
function mutation(opts: GateOptions, state: JsonObject, tests: readonly string[]): GateOutcome {
  const domain = stringList(state, "domainSources");
  if (domain === undefined) {
    return fail("mutation", "pré-condição", ["estado sem `domainSources` (use [] se a feature não tem domínio)"]);
  }
  const hasMut = criteriaOf(state).criteria.some((criterion) => criterion.camadas.includes("mut"));
  if (domain.length === 0) {
    return hasMut
      ? fail("mutation", "pré-condição", ["`domainSources` vazio, mas há critério com camada mut"])
      : {
          gate: "mutation",
          pass: true,
          detail: "nada a medir: `domainSources` vazio e nenhum critério mut",
          problems: [],
        };
  }
  const config = readProjectGates(opts.root).get("mutation");
  const minScore = config?.["min_score"];
  if (typeof minScore !== "number") {
    return fail("mutation", "pré-condição", ["harness.project.yaml sem `gates.mutation.min_score`"]);
  }
  const tool = config?.["tool"];
  if (tool !== "stryker") {
    return fail("mutation", "pré-condição", [`gates.mutation.tool "${String(tool)}" sem suporte (use stryker)`]);
  }
  const sources = stringList(state, "sources") ?? [];
  const outside = domain.filter((file) => !sources.includes(file)).map((file) => `${file}: fora de \`sources\``);
  const suiteGroups = groupByPackage(opts.root, featureSuite(opts.root, state, tests));
  const byPkg = sourcesByPackage(opts.root, domain, suiteGroups, "domainSources");
  if (outside.length > 0 || byPkg.problems.length > 0) {
    return fail("mutation", "pré-condição", [...outside, ...byPkg.problems]);
  }
  const problems: string[] = [];
  const scores: string[] = [];
  for (const [pkg, files] of byPkg.groups) {
    const result = mutationOfPackage(opts, pkg, files, suiteGroups.get(pkg) ?? [], minScore);
    problems.push(...result.problems);
    scores.push(...result.scores);
  }
  return problems.length > 0
    ? fail("mutation", `score abaixo de ${String(minScore)}% ou mutação inválida`, problems)
    : { gate: "mutation", pass: true, detail: `score >= ${String(minScore)}%: ${scores.join("; ")}`, problems: [] };
}

interface E2eTest {
  readonly file: string;
  readonly title: string;
  readonly name: string;
  readonly status: string;
}

function collectE2e(suite: JsonObject, path: readonly string[], out: E2eTest[]): void {
  const specs = suite["specs"];
  for (const spec of Array.isArray(specs) ? specs : []) {
    if (!isJsonObject(spec)) continue;
    const title = stringAt(spec, "title") ?? "";
    const file = stringAt(spec, "file") ?? "";
    const tests = spec["tests"];
    for (const test of Array.isArray(tests) ? tests : []) {
      if (!isJsonObject(test)) continue;
      const status = stringAt(test, "status") ?? "unknown";
      out.push({ file, title, name: [...path, title].join(" > "), status });
    }
  }
  const children = suite["suites"];
  for (const child of Array.isArray(children) ? children : []) {
    if (isJsonObject(child)) collectE2e(child, [...path, stringAt(child, "title") ?? ""], out);
  }
}

/** Relatório JSON do Playwright: testes (com o caminho de describes), pasta base e erros globais. */
export function parsePlaywrightReport(text: string): { rootDir: string | undefined; tests: E2eTest[]; errors: number } {
  let report: Json;
  try {
    report = parseJson(text);
  } catch {
    throw new GateError(["relatório do playwright ilegível (JSON inválido no stdout)"]);
  }
  if (!isJsonObject(report)) throw new GateError(["relatório do playwright ilegível"]);
  const tests: E2eTest[] = [];
  const suites = report["suites"];
  for (const suite of Array.isArray(suites) ? suites : []) {
    if (isJsonObject(suite)) collectE2e(suite, [], tests);
  }
  const errors = report["errors"];
  const config = objectAt(report, "config");
  return {
    rootDir: config === undefined ? undefined : stringAt(config, "rootDir"),
    tests,
    errors: Array.isArray(errors) ? errors.length : 0,
  };
}

function e2eOfPackage(
  opts: GateOptions,
  pkg: string,
  files: readonly string[],
): { tests: E2eTest[]; problems: string[] } {
  const label = relative(opts.root, pkg);
  const run = opts.run("pnpm", ["exec", "playwright", "test", ...files, "--reporter=json"], pkg);
  let parsed: ReturnType<typeof parsePlaywrightReport>;
  try {
    parsed = parsePlaywrightReport(run.stdout);
  } catch (error) {
    if (!(error instanceof GateError)) throw error;
    return { tests: [], problems: error.problems.map((p) => `${label}: ${p}\n${lastLines(run.stderr, 15)}`) };
  }
  const problems: string[] = [];
  const base = parsed.rootDir ?? pkg;
  for (const file of files) {
    if (!parsed.tests.some((test) => resolve(base, test.file) === resolve(pkg, file))) {
      problems.push(`${join(label, file)}: nenhum teste e2e rodou`);
    }
  }
  for (const test of parsed.tests) {
    if (test.status === "skipped") problems.push(`${label}: "${test.name}" pulado; pular é FAIL`);
    else if (test.status !== "expected") problems.push(`${label}: "${test.name}" falhou (${test.status})`);
  }
  if (parsed.errors > 0) problems.push(`${label}: ${String(parsed.errors)} erro(s) do playwright fora dos testes`);
  if (run.status !== 0 && problems.length === 0) {
    problems.push(`${label}: playwright saiu com código ${String(run.status)}\n${lastLines(run.stderr, 15)}`);
  }
  return { tests: parsed.tests, problems };
}

/** Fluxos e2e da feature (`e2e` do estado) com a ferramenta de `gates.e2e` do harness.project.yaml. */
function e2e(opts: GateOptions, state: JsonObject): GateOutcome {
  const files = stringList(state, "e2e");
  if (files === undefined) {
    return fail("e2e", "pré-condição", ["estado sem `e2e` (use [] se não há critério e2e)"]);
  }
  const hasE2e = criteriaOf(state).criteria.some((criterion) => criterion.camadas.includes("e2e"));
  if (files.length === 0) {
    return hasE2e
      ? fail("e2e", "pré-condição", ["`e2e` vazio, mas há critério com camada e2e"])
      : { gate: "e2e", pass: true, detail: "nenhum e2e na feature (nenhum critério e2e)", problems: [] };
  }
  checkFilesExist(opts.root, files);
  const tool = readProjectGates(opts.root).get("e2e")?.["tool"];
  if (tool !== "playwright") {
    return fail("e2e", "pré-condição", [`gates.e2e.tool "${String(tool)}" ausente ou sem suporte (use playwright)`]);
  }
  const problems: string[] = [];
  const ran: E2eTest[] = [];
  for (const [pkg, pkgFiles] of groupByPackage(opts.root, files)) {
    const result = e2eOfPackage(opts, pkg, pkgFiles);
    problems.push(...result.problems);
    ran.push(...result.tests);
  }
  if (ran.length === 0 && problems.length === 0) problems.push("nenhum teste e2e rodou");
  for (const scenario of scenariosOf(state)) {
    if (scenario.camada !== "e2e") continue;
    const name = scenario.teste ?? "";
    if (!ran.some((test) => test.title === name || test.name === name || test.name.endsWith(` > ${name}`))) {
      problems.push(`${scenario.id}: teste e2e "${name}" fora do relatório`);
    }
  }
  const failed = problems.length;
  return failed > 0
    ? fail("e2e", `${String(ran.length)} teste(s) e2e, ${String(failed)} problema(s)`, problems)
    : { gate: "e2e", pass: true, detail: `${String(ran.length)} teste(s) e2e passaram`, problems: [] };
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
    if (gate === "e2e") {
      outcome = e2e(opts, state);
    } else {
      const files = testFiles(state);
      checkFilesExist(opts.root, files);
      if (gate === "expect-red") outcome = expectRed(opts, files);
      else if (gate === "tests-reviewed") outcome = testsReviewed(opts, state, files);
      else if (gate === "coverage") outcome = coverage(opts, state, files);
      else outcome = mutation(opts, state, files);
    }
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
