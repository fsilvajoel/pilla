import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  main,
  packageOf,
  productionFile,
  readProjectGates,
  runGate,
  spawnRunner,
  type RunResult,
  type Runner,
} from "./gates.mts";

const FEATURE = "F1";
const TEST_FILE = "pkg/src/a.test.ts";
const PROD_FILE = "pkg/src/a.ts";
const E2E_FILE = "pkg/e2e/a.e2e.ts";
const NOW = new Date("2026-11-17T12:00:00.000Z");
const CRITERIA = [{ id: "A1", camadas: ["unit"] }];
const SCENARIOS = [{ id: "C1", criterio: "A1", camada: "unit", arquivo: TEST_FILE, teste: "x" }];
const BASE = { feature: FEATURE, tests: [TEST_FILE], criteria: CRITERIA, scenarios: SCENARIOS };
const PROJECT_YAML = `commands:
  test: x
gates:
  mutation: { tool: stryker, min_score: 80 }
  e2e: { tool: playwright }
portable:
  forbidden: []
`;

interface FakeMutant {
  readonly status: string;
  readonly line?: number;
  readonly mutator?: string;
}

interface FakeReport {
  readonly passed: number;
  readonly failed: number;
  readonly pending?: number;
  readonly files?: readonly { readonly name: string; readonly statuses: readonly string[] }[];
}

interface FakeVitest {
  readonly report?: FakeReport;
  readonly status?: number;
  readonly linesTotal?: number;
  readonly branchesCovered?: number;
  readonly summaryFiles?: readonly string[];
  /** Mutantes por arquivo (relativo ao pacote) no mutation.json do stryker falso; ausente = sem relatório. */
  readonly mutants?: Readonly<Record<string, readonly FakeMutant[]>>;
  readonly strykerStatus?: number;
  /** stdout do playwright falso. */
  readonly playwright?: string;
  readonly playwrightStatus?: number;
  readonly calls: { cmd: string; args: readonly string[]; cwd: string }[];
}

let root = "";

function argValue(args: readonly string[], prefix: string): string | undefined {
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function fakeRunner(fake: FakeVitest): Runner {
  return (cmd, args, cwd): RunResult => {
    fake.calls.push({ cmd, args, cwd });
    if (cmd === "git") return spawnRunner(cmd, args, cwd);
    if (args[1] === "stryker") return fakeStryker(fake, args[3] ?? "");
    if (args[1] === "playwright") {
      return { status: fake.playwrightStatus ?? 0, stdout: fake.playwright ?? "", stderr: "playwright stderr" };
    }
    const out = argValue(args, "--outputFile=");
    const report = fake.report;
    if (out !== undefined && report !== undefined) {
      const files = report.files ?? [
        {
          name: join(root, TEST_FILE),
          statuses: [...Array<string>(report.failed).fill("failed"), ...Array<string>(report.passed).fill("passed")],
        },
      ];
      writeFileSync(
        out,
        JSON.stringify({
          numTotalTests: report.passed + report.failed + (report.pending ?? 0),
          numPassedTests: report.passed,
          numFailedTests: report.failed,
          numPendingTests: report.pending ?? 0,
          numTodoTests: 0,
          testResults: files.map((f) => ({ name: f.name, assertionResults: f.statuses.map((status) => ({ status })) })),
        }),
      );
    }
    const covDir = argValue(args, "--coverage.reportsDirectory=");
    if (covDir !== undefined && fake.linesTotal !== undefined) {
      mkdirSync(covDir, { recursive: true });
      const lines = { total: fake.linesTotal, covered: fake.linesTotal };
      const entry = {
        lines,
        statements: lines,
        functions: { total: 2, covered: 2 },
        branches: { total: 4, covered: fake.branchesCovered ?? 4 },
      };
      const summary: Record<string, typeof entry> = { total: entry };
      for (const file of fake.summaryFiles ?? [PROD_FILE]) summary[join(root, file)] = entry;
      writeFileSync(join(covDir, "coverage-summary.json"), JSON.stringify(summary));
    }
    return { status: fake.status ?? 0, stdout: "", stderr: "limite de cobertura: lines 80% < 100%" };
  };
}

function fakeStryker(fake: FakeVitest, configFile: string): RunResult {
  const config: unknown = JSON.parse(readFileSync(configFile, "utf8"));
  const fileName = (config as { jsonReporter: { fileName: string } }).jsonReporter.fileName;
  if (fake.mutants !== undefined) {
    const files: Record<string, { mutants: unknown[] }> = {};
    for (const [file, mutants] of Object.entries(fake.mutants)) {
      files[file] = {
        mutants: mutants.map((m) => ({
          status: m.status,
          mutatorName: m.mutator ?? "ConditionalExpression",
          location: { start: { line: m.line ?? 1, column: 1 } },
        })),
      };
    }
    writeFileSync(fileName, JSON.stringify({ schemaVersion: "2", files }));
  }
  return { status: fake.strykerStatus ?? 0, stdout: "", stderr: "stryker stderr" };
}

function mutants(killed: number, survived: number): FakeMutant[] {
  return [
    ...Array.from({ length: killed }, (): FakeMutant => ({ status: "Killed" })),
    ...Array.from({ length: survived }, (_, i): FakeMutant => ({ status: "Survived", line: i + 10 })),
  ];
}

interface FakeSpec {
  readonly title: string;
  readonly status: string;
}

function playwrightReport(specs: readonly FakeSpec[], extra: { errors?: number; describe?: string } = {}): string {
  const specJson = specs.map((spec) => ({
    title: spec.title,
    file: "a.e2e.ts",
    tests: [{ status: spec.status, results: [{ status: spec.status === "expected" ? "passed" : "failed" }] }],
  }));
  const inner =
    extra.describe === undefined ? [] : [{ title: extra.describe, file: "a.e2e.ts", specs: specJson, suites: [] }];
  return JSON.stringify({
    config: { rootDir: join(root, "pkg", "e2e") },
    suites: [
      { title: "a.e2e.ts", file: "a.e2e.ts", specs: extra.describe === undefined ? specJson : [], suites: inner },
    ],
    errors: Array.from({ length: extra.errors ?? 0 }, () => ({ message: "boom" })),
    stats: { expected: specs.length },
  });
}

function writeState(state: Record<string, unknown>): void {
  writeFileSync(join(root, "docs", "plano", FEATURE, "estado.json"), JSON.stringify(state));
}

function readStateFile(): Record<string, unknown> {
  const parsed: unknown = JSON.parse(readFileSync(join(root, "docs", "plano", FEATURE, "estado.json"), "utf8"));
  return parsed as Record<string, unknown>;
}

function gateEntry(name: string): { status: string; at: string; detail: string } {
  const gates = readStateFile()["gates"] as Record<string, { status: string; at: string; detail: string }>;
  const entry = gates[name];
  if (entry === undefined) throw new Error(`gate ${name} não gravado`);
  return entry;
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "gates-test-"));
  mkdirSync(join(root, "docs", "plano", FEATURE), { recursive: true });
  mkdirSync(join(root, "pkg", "src"), { recursive: true });
  writeFileSync(join(root, "pkg", "package.json"), "{}");
  writeFileSync(join(root, TEST_FILE), "it('x', () => {});\n");
  writeFileSync(join(root, PROD_FILE), "export const a = 1;\n");
  writeFileSync(join(root, "harness.project.yaml"), PROJECT_YAML);
  writeState(BASE);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("expect-red", () => {
  it("passes when every test of every listed file fails, and records PASS in the state", () => {
    const fake: FakeVitest = { report: { passed: 0, failed: 3 }, calls: [] };
    const outcome = runGate("expect-red", { root, feature: FEATURE, run: fakeRunner(fake), now: () => NOW });
    expect(outcome.pass).toBe(true);
    expect(gateEntry("expect-red")).toEqual({
      status: "PASS",
      at: NOW.toISOString(),
      detail: "3 teste(s), todos falhando",
    });
    expect(fake.calls[0]?.cwd).toBe(join(root, "pkg"));
    expect(fake.calls[0]?.args).toContain("src/a.test.ts");
  });

  it("fails naming the file when a test passes before the implementation", () => {
    const fake: FakeVitest = { report: { passed: 1, failed: 2 }, calls: [] };
    const outcome = runGate("expect-red", { root, feature: FEATURE, run: fakeRunner(fake), now: () => NOW });
    expect(outcome.pass).toBe(false);
    expect(outcome.problems).toEqual([
      "pkg/src/a.test.ts: 1 teste(s) passaram sem implementação (teste que não testa nada)",
    ]);
    expect(gateEntry("expect-red").status).toBe("FAIL");
  });

  it("fails when a listed file ran no test (import error)", () => {
    const fake: FakeVitest = {
      report: { passed: 0, failed: 0, files: [{ name: join(root, TEST_FILE), statuses: [] }] },
      calls: [],
    };
    const outcome = runGate("expect-red", { root, feature: FEATURE, run: fakeRunner(fake) });
    expect(outcome.pass).toBe(false);
    expect(outcome.problems).toEqual(["pkg/src/a.test.ts: nenhum teste executado (erro de import ou sintaxe?)"]);
  });

  it("fails when a test is skipped", () => {
    const fake: FakeVitest = { report: { passed: 0, failed: 1, pending: 1 }, calls: [] };
    const outcome = runGate("expect-red", { root, feature: FEATURE, run: fakeRunner(fake) });
    expect(outcome.pass).toBe(false);
    expect(outcome.problems).toContain("pkg: 1 teste(s) pulado(s) ou todo; pular é FAIL");
  });

  it("fails when vitest produced no report", () => {
    const fake: FakeVitest = { calls: [] };
    const outcome = runGate("expect-red", { root, feature: FEATURE, run: fakeRunner(fake) });
    expect(outcome.pass).toBe(false);
    expect(outcome.problems[0]).toMatch(/^pkg: o vitest não gerou relatório/);
  });

  it("fails when the state lists no tests", () => {
    writeState({ feature: FEATURE });
    const outcome = runGate("expect-red", { root, feature: FEATURE, run: fakeRunner({ calls: [] }) });
    expect(outcome.pass).toBe(false);
    expect(outcome.problems[0]).toMatch(/^estado sem `tests`/);
  });

  it("fails when a listed test file does not exist", () => {
    writeState({ feature: FEATURE, tests: ["pkg/src/missing.test.ts"] });
    const outcome = runGate("expect-red", { root, feature: FEATURE, run: fakeRunner({ calls: [] }) });
    expect(outcome.problems).toEqual(["pkg/src/missing.test.ts: arquivo de teste não existe"]);
  });

  it("fails without writing anything when the state file is missing", () => {
    rmSync(join(root, "docs", "plano", FEATURE, "estado.json"));
    const outcome = runGate("expect-red", { root, feature: FEATURE, run: fakeRunner({ calls: [] }) });
    expect(outcome.pass).toBe(false);
    expect(outcome.problems[0]).toMatch(/^falta docs\/plano\/F1\/estado\.json/);
  });
});

describe("tests-reviewed", () => {
  const git = fakeRunner({ calls: [] });

  it("refuses to sign before expect-red passed", () => {
    const outcome = runGate("tests-reviewed", { root, feature: FEATURE, run: git, sign: true });
    expect(outcome.pass).toBe(false);
    expect(outcome.problems[0]).toMatch(/expect-red/);
    expect(readStateFile()["testShas"]).toBeUndefined();
  });

  it("signs the git blob sha of each test and then passes while the file is unchanged", () => {
    writeState({ ...BASE, gates: { "expect-red": { status: "PASS" } } });
    expect(runGate("tests-reviewed", { root, feature: FEATURE, run: git, sign: true }).pass).toBe(true);
    const sha = spawnRunner("git", ["hash-object", TEST_FILE], root).stdout.trim();
    expect(readStateFile()["testShas"]).toEqual({ [TEST_FILE]: sha });
    expect(runGate("tests-reviewed", { root, feature: FEATURE, run: git }).pass).toBe(true);
  });

  it("fails naming the file when a reviewed test changed", () => {
    writeState({ ...BASE, gates: { "expect-red": { status: "PASS" } } });
    runGate("tests-reviewed", { root, feature: FEATURE, run: git, sign: true });
    writeFileSync(join(root, TEST_FILE), "it('x', () => { /* changed */ });\n");
    const outcome = runGate("tests-reviewed", { root, feature: FEATURE, run: git });
    expect(outcome.pass).toBe(false);
    expect(outcome.problems).toEqual([`${TEST_FILE}: mudou depois da revisão (volte à revisão dos testes)`]);
    expect(gateEntry("tests-reviewed").status).toBe("FAIL");
  });

  it("fails when there is no signature", () => {
    const outcome = runGate("tests-reviewed", { root, feature: FEATURE, run: git });
    expect(outcome.pass).toBe(false);
    expect(outcome.problems[0]).toMatch(/--sign/);
  });

  it("fails when a test was added after the signature", () => {
    writeFileSync(join(root, "pkg", "src", "b.test.ts"), "it('y', () => {});\n");
    const sha = spawnRunner("git", ["hash-object", TEST_FILE], root).stdout.trim();
    writeState({ ...BASE, tests: [TEST_FILE, "pkg/src/b.test.ts"], testShas: { [TEST_FILE]: sha } });
    const outcome = runGate("tests-reviewed", { root, feature: FEATURE, run: git });
    expect(outcome.problems).toEqual(["pkg/src/b.test.ts: sem sha assinado (teste novo precisa de revisão e --sign)"]);
  });

  it("fails when the state has no criteria", () => {
    writeState({ feature: FEATURE, tests: [TEST_FILE], gates: { "expect-red": { status: "PASS" } } });
    const outcome = runGate("tests-reviewed", { root, feature: FEATURE, run: git, sign: true });
    expect(outcome.detail).toBe("camadas dos critérios não fecham");
    expect(outcome.problems[0]).toMatch(/^estado sem `criteria`/);
    expect(readStateFile()["testShas"]).toBeUndefined();
  });

  it("fails on empty or invalid layers", () => {
    writeState({
      ...BASE,
      criteria: [{ id: "A1", camadas: ["unit"] }, { id: "A2", camadas: [] }, { id: "A3", camadas: ["smoke"] }, {}],
    });
    const outcome = runGate("tests-reviewed", { root, feature: FEATURE, run: git });
    expect(outcome.problems).toEqual([
      "A2: `camadas` vazia ou ausente",
      "A3: camada inválida (use unit, prop, e2e ou mut)",
      "criteria[3]: critério sem `id`",
      "criteria[3]: `camadas` vazia ou ausente",
    ]);
  });

  it("fails on scenarios without layer, with unknown criterion, mut layer or file outside the layer list", () => {
    writeState({
      ...BASE,
      scenarios: [
        ...SCENARIOS,
        { id: "C2", criterio: "A1", arquivo: TEST_FILE, teste: "y" },
        { id: "C3", criterio: "A9", camada: "unit", arquivo: TEST_FILE, teste: "z" },
        { id: "C4", criterio: "A1", camada: "mut", arquivo: TEST_FILE },
        { id: "C5", criterio: "A1", camada: "unit", arquivo: "pkg/src/other.test.ts" },
      ],
    });
    const outcome = runGate("tests-reviewed", { root, feature: FEATURE, run: git });
    expect(outcome.problems).toEqual([
      "C2 (y): scenario sem `camada`",
      'C3 (z): critério "A9" fora de `criteria`',
      'C4: camada "mut" inválida no scenario (use unit, prop ou e2e)',
      'C5: arquivo "pkg/src/other.test.ts" fora de `tests`',
    ]);
  });

  it("fails when a criterion layer has no scenario of that layer; mut needs no scenario", () => {
    writeState({ ...BASE, criteria: [{ id: "A1", camadas: ["unit", "prop", "e2e", "mut"] }] });
    const outcome = runGate("tests-reviewed", { root, feature: FEATURE, run: git });
    expect(outcome.problems).toEqual([
      "A1: sem scenario da camada prop com arquivo em `tests`",
      "A1: sem scenario da camada e2e com arquivo em `e2e`",
    ]);
  });

  it("requires the e2e scenario file to be in `e2e`, signs the e2e files and checks their sha", () => {
    mkdirSync(join(root, "pkg", "e2e"), { recursive: true });
    writeFileSync(join(root, E2E_FILE), "test('home', () => {});\n");
    const e2eScenario = { id: "C2", criterio: "A1", camada: "e2e", arquivo: E2E_FILE, teste: "home" };
    const state = {
      ...BASE,
      criteria: [{ id: "A1", camadas: ["unit", "e2e"] }],
      scenarios: [...SCENARIOS, e2eScenario],
      gates: { "expect-red": { status: "PASS" } },
    };
    writeState(state);
    expect(runGate("tests-reviewed", { root, feature: FEATURE, run: git, sign: true }).problems).toEqual([
      `C2 (home): arquivo "${E2E_FILE}" fora de \`e2e\``,
      "A1: sem scenario da camada e2e com arquivo em `e2e`",
    ]);
    writeState({ ...state, e2e: [E2E_FILE] });
    expect(runGate("tests-reviewed", { root, feature: FEATURE, run: git, sign: true }).pass).toBe(true);
    expect(Object.keys(readStateFile()["testShas"] as object)).toEqual([TEST_FILE, E2E_FILE]);
    writeFileSync(join(root, E2E_FILE), "test('home', () => { /* changed */ });\n");
    expect(runGate("tests-reviewed", { root, feature: FEATURE, run: git }).problems).toEqual([
      `${E2E_FILE}: mudou depois da revisão (volte à revisão dos testes)`,
    ]);
  });

  it("fails when a listed e2e file does not exist", () => {
    writeState({ ...BASE, e2e: [E2E_FILE] });
    const outcome = runGate("tests-reviewed", { root, feature: FEATURE, run: git });
    expect(outcome.problems).toEqual([`${E2E_FILE}: arquivo de teste não existe`]);
  });

  it("fails when a signed file left the lists", () => {
    const sha = spawnRunner("git", ["hash-object", TEST_FILE], root).stdout.trim();
    writeState({ ...BASE, testShas: { [TEST_FILE]: sha, "pkg/src/old.test.ts": sha } });
    const outcome = runGate("tests-reviewed", { root, feature: FEATURE, run: git });
    expect(outcome.problems).toEqual(["pkg/src/old.test.ts: assinado mas fora de `tests` e `e2e` do estado"]);
  });
});

describe("coverage", () => {
  it("runs only the feature tests, measures only their production files and passes at 100%", () => {
    const fake: FakeVitest = { report: { passed: 4, failed: 0 }, linesTotal: 50, calls: [] };
    const outcome = runGate("coverage", { root, feature: FEATURE, run: fakeRunner(fake) });
    expect(outcome.pass).toBe(true);
    expect(outcome.detail).toBe("100% nos arquivos da feature em pkg (src/a.ts)");
    const args = fake.calls[0]?.args ?? [];
    expect(args).toContain("src/a.test.ts");
    expect(args).toContain("--coverage.enabled=true");
    expect(args).toContain("--coverage.include=src/a.ts");
    expect(args).toContain("--coverage.exclude=");
    expect(args).toContain("--coverage.thresholds.branches=100");
    expect(gateEntry("coverage").status).toBe("PASS");
  });

  it("escapes glob characters of the production file path", () => {
    mkdirSync(join(root, "pkg", "app", "(admin)"), { recursive: true });
    writeFileSync(join(root, "pkg", "app", "(admin)", "page.test.tsx"), "it('x', () => {});\n");
    writeFileSync(join(root, "pkg", "app", "(admin)", "page.tsx"), "export {};\n");
    writeState({ feature: FEATURE, tests: ["pkg/app/(admin)/page.test.tsx"] });
    const fake: FakeVitest = {
      report: {
        passed: 1,
        failed: 0,
        files: [{ name: join(root, "pkg/app/(admin)/page.test.tsx"), statuses: ["passed"] }],
      },
      linesTotal: 5,
      summaryFiles: ["pkg/app/(admin)/page.tsx"],
      calls: [],
    };
    const outcome = runGate("coverage", { root, feature: FEATURE, run: fakeRunner(fake) });
    expect(outcome.pass).toBe(true);
    expect(fake.calls[0]?.args).toContain("--coverage.include=app/\\(admin\\)/page.tsx");
  });

  it("fails below 100% naming the file and the metric", () => {
    const fake: FakeVitest = { report: { passed: 4, failed: 0 }, linesTotal: 50, branchesCovered: 3, calls: [] };
    const outcome = runGate("coverage", { root, feature: FEATURE, run: fakeRunner(fake) });
    expect(outcome.problems).toEqual(["pkg/src/a.ts: cobertura abaixo de 100% (branches 3/4)"]);
  });

  it("fails on empty coverage (0/0)", () => {
    const fake: FakeVitest = { report: { passed: 4, failed: 0 }, linesTotal: 0, calls: [] };
    const outcome = runGate("coverage", { root, feature: FEATURE, run: fakeRunner(fake) });
    expect(outcome.pass).toBe(false);
    expect(outcome.problems[0]).toMatch(/0\/0/);
  });

  it("fails when a production file is missing from the coverage report (excluded)", () => {
    const fake: FakeVitest = { report: { passed: 4, failed: 0 }, linesTotal: 50, summaryFiles: [], calls: [] };
    const outcome = runGate("coverage", { root, feature: FEATURE, run: fakeRunner(fake) });
    expect(outcome.problems).toEqual([
      "pkg/src/a.ts: fora do relatório de cobertura (excluído ou não carregado pelos testes)",
    ]);
  });

  it("fails without running vitest when the production file does not exist", () => {
    rmSync(join(root, PROD_FILE));
    const fake: FakeVitest = { report: { passed: 4, failed: 0 }, linesTotal: 50, calls: [] };
    const outcome = runGate("coverage", { root, feature: FEATURE, run: fakeRunner(fake) });
    expect(outcome.problems).toEqual(["pkg/src/a.ts: arquivo de produção não existe"]);
    expect(fake.calls).toEqual([]);
  });

  it("fails when a feature test is not in the vitest report", () => {
    const fake: FakeVitest = { report: { passed: 4, failed: 0, files: [] }, linesTotal: 50, calls: [] };
    const outcome = runGate("coverage", { root, feature: FEATURE, run: fakeRunner(fake) });
    expect(outcome.problems).toEqual(["pkg/src/a.test.ts: teste da feature não rodou (fora do relatório do vitest)"]);
  });

  it("fails when the threshold makes vitest exit non-zero", () => {
    const fake: FakeVitest = { report: { passed: 4, failed: 0 }, linesTotal: 50, status: 1, calls: [] };
    const outcome = runGate("coverage", { root, feature: FEATURE, run: fakeRunner(fake) });
    expect(outcome.pass).toBe(false);
    expect(outcome.problems[0]).toMatch(/limite de cobertura/);
  });

  it("fails on skipped and failing tests", () => {
    const fake: FakeVitest = { report: { passed: 3, failed: 1, pending: 2 }, linesTotal: 50, status: 1, calls: [] };
    const outcome = runGate("coverage", { root, feature: FEATURE, run: fakeRunner(fake) });
    expect(outcome.problems).toEqual(["pkg: 1 teste(s) falhando", "pkg: 2 teste(s) pulado(s) ou todo; pular é FAIL"]);
  });

  it("fails when the coverage summary is missing", () => {
    const fake: FakeVitest = { report: { passed: 4, failed: 0 }, calls: [] };
    const outcome = runGate("coverage", { root, feature: FEATURE, run: fakeRunner(fake) });
    expect(outcome.problems).toEqual(["pkg: cobertura não gerada (coverage-summary.json ausente)"]);
  });

  describe("with sources", () => {
    beforeEach(() => {
      writeFileSync(join(root, "pkg", "src", "b.ts"), "export const b = 1;\n");
      writeFileSync(join(root, "pkg", "src", "r.test.ts"), "it('r', () => {});\n");
    });

    it("measures the sources and runs tests plus regressionTests", () => {
      writeState({ ...BASE, sources: [PROD_FILE, "pkg/src/b.ts"], regressionTests: ["pkg/src/r.test.ts"] });
      const fake: FakeVitest = {
        report: {
          passed: 2,
          failed: 0,
          files: [
            { name: join(root, TEST_FILE), statuses: ["passed"] },
            { name: join(root, "pkg/src/r.test.ts"), statuses: ["passed"] },
          ],
        },
        linesTotal: 10,
        summaryFiles: [PROD_FILE, "pkg/src/b.ts"],
        calls: [],
      };
      const outcome = runGate("coverage", { root, feature: FEATURE, run: fakeRunner(fake) });
      expect(outcome.pass).toBe(true);
      expect(outcome.detail).toBe("100% nos arquivos da feature em pkg (src/a.ts, src/b.ts)");
      const args = fake.calls[0]?.args ?? [];
      expect(args).toEqual(expect.arrayContaining(["src/a.test.ts", "src/r.test.ts"]));
      expect(args).toEqual(expect.arrayContaining(["--coverage.include=src/a.ts", "--coverage.include=src/b.ts"]));
    });

    it("fails when a source is not in the coverage report", () => {
      writeState({ ...BASE, sources: [PROD_FILE, "pkg/src/b.ts"] });
      const fake: FakeVitest = { report: { passed: 1, failed: 0 }, linesTotal: 10, calls: [] };
      const outcome = runGate("coverage", { root, feature: FEATURE, run: fakeRunner(fake) });
      expect(outcome.problems).toEqual([
        "pkg/src/b.ts: fora do relatório de cobertura (excluído ou não carregado pelos testes)",
      ]);
    });

    it("fails on empty, missing or out-of-package sources without running vitest", () => {
      mkdirSync(join(root, "other"), { recursive: true });
      writeFileSync(join(root, "other", "package.json"), "{}");
      writeFileSync(join(root, "other", "x.ts"), "");
      const fake: FakeVitest = { report: { passed: 1, failed: 0 }, linesTotal: 10, calls: [] };
      writeState({ ...BASE, sources: [] });
      expect(runGate("coverage", { root, feature: FEATURE, run: fakeRunner(fake) }).problems).toEqual([
        "`sources` vazio: liste os arquivos de produção da feature",
      ]);
      writeState({ ...BASE, sources: ["pkg/src/missing.ts", "other/x.ts", "/abs.ts"] });
      expect(runGate("coverage", { root, feature: FEATURE, run: fakeRunner(fake) }).problems).toEqual([
        "pkg/src/missing.ts: arquivo de `sources` não existe",
        "other/x.ts: fora de um pacote com testes da feature (other)",
        '/abs.ts: use caminho relativo à raiz, sem ".."',
      ]);
      expect(fake.calls).toEqual([]);
    });

    it("does not apply the name rule when sources is given", () => {
      rmSync(join(root, PROD_FILE));
      writeState({ ...BASE, sources: ["pkg/src/b.ts"] });
      const fake: FakeVitest = {
        report: { passed: 1, failed: 0 },
        linesTotal: 10,
        summaryFiles: ["pkg/src/b.ts"],
        calls: [],
      };
      expect(runGate("coverage", { root, feature: FEATURE, run: fakeRunner(fake) }).pass).toBe(true);
    });

    it("runs a package without sources with coverage disabled", () => {
      mkdirSync(join(root, "other"), { recursive: true });
      writeFileSync(join(root, "other", "package.json"), "{}");
      writeFileSync(join(root, "other", "o.test.ts"), "");
      writeState({ ...BASE, sources: [PROD_FILE], regressionTests: ["other/o.test.ts"] });
      const fake: FakeVitest = {
        report: {
          passed: 2,
          failed: 0,
          files: [
            { name: join(root, TEST_FILE), statuses: ["passed"] },
            { name: join(root, "other/o.test.ts"), statuses: ["passed"] },
          ],
        },
        linesTotal: 10,
        calls: [],
      };
      const outcome = runGate("coverage", { root, feature: FEATURE, run: fakeRunner(fake) });
      expect(outcome.pass).toBe(true);
      const otherCall = fake.calls.find((call) => call.cwd === join(root, "other"));
      expect(otherCall?.args).toContain("--coverage.enabled=false");
    });

    it("fails when a regression test does not exist", () => {
      writeState({ ...BASE, sources: [PROD_FILE], regressionTests: ["pkg/src/gone.test.ts"] });
      const outcome = runGate("coverage", { root, feature: FEATURE, run: fakeRunner({ calls: [] }) });
      expect(outcome.problems).toEqual(["pkg/src/gone.test.ts: arquivo de teste não existe"]);
    });
  });
});

describe("mutation", () => {
  const MUT_STATE = { ...BASE, sources: [PROD_FILE], domainSources: [PROD_FILE] };
  const green: FakeReport = { passed: 3, failed: 0 };

  function strykerConfig(fake: FakeVitest): { mutate: string[]; testFiles: string[]; thresholds: { low: number } } {
    const call = fake.calls.find((c) => c.args[1] === "stryker");
    const parsed: unknown = JSON.parse(readFileSync(call?.args[3] ?? "", "utf8"));
    return parsed as { mutate: string[]; testFiles: string[]; thresholds: { low: number } };
  }

  it("passes at or above min_score, mutating only the domainSources, and records score and survivors", () => {
    writeState(MUT_STATE);
    let config: ReturnType<typeof strykerConfig> | undefined;
    const fake: FakeVitest = { report: green, mutants: { "src/a.ts": mutants(8, 2) }, calls: [] };
    const base = fakeRunner(fake);
    const run: Runner = (cmd, args, cwd) => {
      const result = base(cmd, args, cwd);
      if (args[1] === "stryker") config = strykerConfig(fake);
      return result;
    };
    const outcome = runGate("mutation", { root, feature: FEATURE, run });
    expect(outcome.pass).toBe(true);
    expect(outcome.detail).toBe(
      "score >= 80%: pkg/src/a.ts 80.00% (8/10); sobreviventes: L10 ConditionalExpression, L11 ConditionalExpression",
    );
    expect(config).toEqual(expect.objectContaining({ mutate: ["src/a.ts"], testFiles: ["src/a.test.ts"] }));
    expect(config?.thresholds.low).toBe(80);
    expect(fake.calls.map((c) => c.args[1])).toEqual(["vitest", "stryker"]);
    expect(fake.calls[1]?.cwd).toBe(join(root, "pkg"));
    expect(gateEntry("mutation").status).toBe("PASS");
  });

  it("fails below min_score listing the survivors; NoCoverage counts as survivor and Timeout as killed", () => {
    writeState(MUT_STATE);
    const list: FakeMutant[] = [
      ...mutants(6, 1),
      { status: "Timeout" },
      { status: "NoCoverage", line: 3, mutator: "StringLiteral" },
      { status: "CompileError" },
      { status: "Ignored" },
    ];
    const fake: FakeVitest = { report: green, mutants: { "src/a.ts": list }, calls: [] };
    const outcome = runGate("mutation", { root, feature: FEATURE, run: fakeRunner(fake) });
    expect(outcome.pass).toBe(false);
    expect(outcome.problems).toEqual([
      "pkg/src/a.ts 77.78% (7/9) < 80%; sobreviventes: L10 ConditionalExpression, L3 StringLiteral (sem cobertura)",
    ]);
  });

  it("includes regressionTests in the suite", () => {
    writeFileSync(join(root, "pkg", "src", "r.test.ts"), "");
    writeState({ ...MUT_STATE, regressionTests: ["pkg/src/r.test.ts"] });
    const fake: FakeVitest = {
      report: { passed: 2, failed: 0 },
      mutants: { "src/a.ts": mutants(1, 0) },
      calls: [],
    };
    let testFiles: string[] = [];
    const base = fakeRunner(fake);
    const run: Runner = (cmd, args, cwd) => {
      const result = base(cmd, args, cwd);
      if (args[1] === "stryker") testFiles = strykerConfig(fake).testFiles;
      return result;
    };
    runGate("mutation", { root, feature: FEATURE, run });
    expect(fake.calls[0]?.args).toEqual(expect.arrayContaining(["src/a.test.ts", "src/r.test.ts"]));
    expect(testFiles).toEqual(["src/a.test.ts", "src/r.test.ts"]);
  });

  it("fails when domainSources is absent; passes with nothing to measure; fails empty with a mut criterion", () => {
    const fake: FakeVitest = { calls: [] };
    writeState(BASE);
    expect(runGate("mutation", { root, feature: FEATURE, run: fakeRunner(fake) }).problems).toEqual([
      "estado sem `domainSources` (use [] se a feature não tem domínio)",
    ]);
    writeState({ ...BASE, domainSources: [] });
    expect(runGate("mutation", { root, feature: FEATURE, run: fakeRunner(fake) })).toEqual(
      expect.objectContaining({ pass: true, detail: "nada a medir: `domainSources` vazio e nenhum critério mut" }),
    );
    writeState({ ...BASE, domainSources: [], criteria: [{ id: "A1", camadas: ["unit", "mut"] }] });
    expect(runGate("mutation", { root, feature: FEATURE, run: fakeRunner(fake) }).problems).toEqual([
      "`domainSources` vazio, mas há critério com camada mut",
    ]);
    expect(fake.calls).toEqual([]);
  });

  it("fails when a domain source is outside sources or does not exist", () => {
    writeState({ ...BASE, sources: [PROD_FILE], domainSources: ["pkg/src/b.ts"] });
    const outcome = runGate("mutation", { root, feature: FEATURE, run: fakeRunner({ calls: [] }) });
    expect(outcome.problems).toEqual([
      "pkg/src/b.ts: fora de `sources`",
      "pkg/src/b.ts: arquivo de `domainSources` não existe",
    ]);
  });

  it("fails without min_score or with an unsupported tool", () => {
    writeState(MUT_STATE);
    writeFileSync(join(root, "harness.project.yaml"), "gates:\n  mutation: { tool: stryker }\n");
    expect(runGate("mutation", { root, feature: FEATURE, run: fakeRunner({ calls: [] }) }).problems).toEqual([
      "harness.project.yaml sem `gates.mutation.min_score`",
    ]);
    writeFileSync(join(root, "harness.project.yaml"), "gates:\n  mutation: { tool: pitest, min_score: 80 }\n");
    expect(runGate("mutation", { root, feature: FEATURE, run: fakeRunner({ calls: [] }) }).problems).toEqual([
      'gates.mutation.tool "pitest" sem suporte (use stryker)',
    ]);
    rmSync(join(root, "harness.project.yaml"));
    expect(runGate("mutation", { root, feature: FEATURE, run: fakeRunner({ calls: [] }) }).problems).toEqual([
      "harness.project.yaml sem `gates.mutation.min_score`",
    ]);
  });

  it("fails on 0 valid mutants (file missing from the report)", () => {
    writeState(MUT_STATE);
    const fake: FakeVitest = { report: green, mutants: { "src/a.ts": [{ status: "Ignored" }] }, calls: [] };
    expect(runGate("mutation", { root, feature: FEATURE, run: fakeRunner(fake) }).problems).toEqual([
      "pkg/src/a.ts: 0 mutantes válidos (arquivo fora do relatório ou sem código mutável)",
    ]);
    const missing: FakeVitest = { report: green, mutants: {}, calls: [] };
    expect(runGate("mutation", { root, feature: FEATURE, run: fakeRunner(missing) }).pass).toBe(false);
  });

  it("fails without mutating when a test fails, is skipped or none ran", () => {
    writeState(MUT_STATE);
    const red: FakeVitest = { report: { passed: 2, failed: 1 }, status: 1, mutants: {}, calls: [] };
    expect(runGate("mutation", { root, feature: FEATURE, run: fakeRunner(red) }).problems).toEqual([
      "pkg: teste falhando antes de mutar (1 falha(s)); corrija antes",
    ]);
    expect(red.calls.map((c) => c.args[1])).toEqual(["vitest"]);
    const skipped: FakeVitest = { report: { passed: 2, failed: 0, pending: 1 }, mutants: {}, calls: [] };
    expect(runGate("mutation", { root, feature: FEATURE, run: fakeRunner(skipped) }).problems).toEqual([
      "pkg: 1 teste(s) pulado(s) ou todo; pular é FAIL",
    ]);
    const none: FakeVitest = { report: { passed: 0, failed: 0 }, mutants: {}, calls: [] };
    expect(runGate("mutation", { root, feature: FEATURE, run: fakeRunner(none) }).problems).toEqual([
      "pkg: nenhum teste executado antes de mutar",
    ]);
  });

  it("fails when the tool produced no report or exited non-zero", () => {
    writeState(MUT_STATE);
    const noReport: FakeVitest = { report: green, strykerStatus: 1, calls: [] };
    expect(runGate("mutation", { root, feature: FEATURE, run: fakeRunner(noReport) }).problems[0]).toMatch(
      /^pkg: o stryker não gerou relatório \(código 1\)\n.*stryker stderr/s,
    );
    const crashed: FakeVitest = { report: green, mutants: { "src/a.ts": mutants(9, 0) }, strykerStatus: 2, calls: [] };
    expect(runGate("mutation", { root, feature: FEATURE, run: fakeRunner(crashed) }).problems[0]).toMatch(
      /^pkg: stryker saiu com código 2/,
    );
  });
});

describe("e2e", () => {
  const E2E_STATE = {
    feature: FEATURE,
    criteria: [{ id: "A1", camadas: ["e2e"] }],
    scenarios: [{ id: "C1", criterio: "A1", camada: "e2e", arquivo: E2E_FILE, teste: "loads home" }],
    e2e: [E2E_FILE],
  };

  beforeEach(() => {
    mkdirSync(join(root, "pkg", "e2e"), { recursive: true });
    writeFileSync(join(root, E2E_FILE), "test('loads home', () => {});\n");
  });

  it("passes when every e2e test passes, without needing `tests`, and finds tests inside describes", () => {
    writeState(E2E_STATE);
    const fake: FakeVitest = {
      playwright: playwrightReport([{ title: "loads home", status: "expected" }], { describe: "home" }),
      calls: [],
    };
    const outcome = runGate("e2e", { root, feature: FEATURE, run: fakeRunner(fake) });
    expect(outcome).toEqual(expect.objectContaining({ pass: true, detail: "1 teste(s) e2e passaram" }));
    expect(fake.calls[0]?.args).toEqual(["exec", "playwright", "test", "e2e/a.e2e.ts", "--reporter=json"]);
    expect(fake.calls[0]?.cwd).toBe(join(root, "pkg"));
    expect(gateEntry("e2e").status).toBe("PASS");
  });

  it("fails naming the failed, flaky and skipped tests", () => {
    writeState(E2E_STATE);
    const fake: FakeVitest = {
      playwright: playwrightReport([
        { title: "loads home", status: "unexpected" },
        { title: "b", status: "flaky" },
        { title: "c", status: "skipped" },
      ]),
      playwrightStatus: 1,
      calls: [],
    };
    const outcome = runGate("e2e", { root, feature: FEATURE, run: fakeRunner(fake) });
    expect(outcome.detail).toBe("3 teste(s) e2e, 3 problema(s)");
    expect(outcome.problems).toEqual([
      'pkg: "loads home" falhou (unexpected)',
      'pkg: "b" falhou (flaky)',
      'pkg: "c" pulado; pular é FAIL',
    ]);
  });

  it("fails when no test ran, on global errors, on unreadable output and on a non-zero exit", () => {
    writeState(E2E_STATE);
    const none: FakeVitest = { playwright: playwrightReport([]), calls: [] };
    expect(runGate("e2e", { root, feature: FEATURE, run: fakeRunner(none) }).problems).toEqual([
      "pkg/e2e/a.e2e.ts: nenhum teste e2e rodou",
      'C1: teste e2e "loads home" fora do relatório',
    ]);
    const errors: FakeVitest = {
      playwright: playwrightReport([{ title: "loads home", status: "expected" }], { errors: 1 }),
      calls: [],
    };
    expect(runGate("e2e", { root, feature: FEATURE, run: fakeRunner(errors) }).problems).toEqual([
      "pkg: 1 erro(s) do playwright fora dos testes",
    ]);
    const garbage: FakeVitest = { playwright: "webServer crashed", playwrightStatus: 1, calls: [] };
    expect(runGate("e2e", { root, feature: FEATURE, run: fakeRunner(garbage) }).problems[0]).toMatch(
      /^pkg: relatório do playwright ilegível/,
    );
    const exit: FakeVitest = {
      playwright: playwrightReport([{ title: "loads home", status: "expected" }]),
      playwrightStatus: 1,
      calls: [],
    };
    expect(runGate("e2e", { root, feature: FEATURE, run: fakeRunner(exit) }).problems[0]).toMatch(
      /^pkg: playwright saiu com código 1/,
    );
  });

  it("fails when an e2e scenario is not in the report", () => {
    writeState(E2E_STATE);
    const fake: FakeVitest = { playwright: playwrightReport([{ title: "other", status: "expected" }]), calls: [] };
    expect(runGate("e2e", { root, feature: FEATURE, run: fakeRunner(fake) }).problems).toEqual([
      'C1: teste e2e "loads home" fora do relatório',
    ]);
  });

  it("fails without `e2e`; passes empty without an e2e criterion; fails empty with one", () => {
    const fake: FakeVitest = { calls: [] };
    writeState(BASE);
    expect(runGate("e2e", { root, feature: FEATURE, run: fakeRunner(fake) }).problems).toEqual([
      "estado sem `e2e` (use [] se não há critério e2e)",
    ]);
    writeState({ ...BASE, e2e: [] });
    expect(runGate("e2e", { root, feature: FEATURE, run: fakeRunner(fake) })).toEqual(
      expect.objectContaining({ pass: true, detail: "nenhum e2e na feature (nenhum critério e2e)" }),
    );
    writeState({ ...E2E_STATE, e2e: [] });
    expect(runGate("e2e", { root, feature: FEATURE, run: fakeRunner(fake) }).problems).toEqual([
      "`e2e` vazio, mas há critério com camada e2e",
    ]);
    expect(fake.calls).toEqual([]);
  });

  it("fails when an e2e file does not exist or the tool is missing", () => {
    writeState({ ...E2E_STATE, e2e: ["pkg/e2e/gone.e2e.ts"] });
    expect(runGate("e2e", { root, feature: FEATURE, run: fakeRunner({ calls: [] }) }).problems).toEqual([
      "pkg/e2e/gone.e2e.ts: arquivo de teste não existe",
    ]);
    writeState(E2E_STATE);
    writeFileSync(join(root, "harness.project.yaml"), "gates:\n  mutation: { tool: stryker, min_score: 80 }\n");
    expect(runGate("e2e", { root, feature: FEATURE, run: fakeRunner({ calls: [] }) }).problems).toEqual([
      'gates.e2e.tool "undefined" ausente ou sem suporte (use playwright)',
    ]);
  });
});

describe("readProjectGates", () => {
  it("reads each gate line of the `gates:` block, with numbers as numbers", () => {
    writeFileSync(join(root, "harness.project.yaml"), `${PROJECT_YAML}gates_extra:\n  x: { a: 1 }\n`);
    expect(Object.fromEntries(readProjectGates(root))).toEqual({
      mutation: { tool: "stryker", min_score: 80 },
      e2e: { tool: "playwright" },
    });
  });
});

describe("productionFile", () => {
  it("drops the .test segment and keeps the extension", () => {
    expect(productionFile("lib/simulation.test.ts")).toBe("lib/simulation.ts");
    expect(productionFile("components/x.test.tsx")).toBe("components/x.tsx");
    expect(productionFile("lib/x.spec.ts")).toBeUndefined();
  });
});

describe("packageOf", () => {
  it("fails for a test outside any package", () => {
    writeFileSync(join(root, "loose.test.ts"), "");
    expect(() => packageOf(root, "loose.test.ts")).toThrow(/fora de pacote/);
  });
});

describe("main", () => {
  const run = fakeRunner({ report: { passed: 0, failed: 1 }, calls: [] });

  it("prints usage and exits 2 on bad arguments", () => {
    expect(main([], root, run).code).toBe(2);
    expect(main(["lint", FEATURE], root, run).output).toMatch(/^gate desconhecido: lint/);
    expect(main(["expect-red", FEATURE, "--sign"], root, run).code).toBe(2);
    expect(main(["expect-red", "../x"], root, run).code).toBe(2);
    expect(main(["coverage", FEATURE, "--skip"], root, run).code).toBe(2);
    expect(main(["mutation", FEATURE, "--sign"], root, run).code).toBe(2);
    expect(main(["e2e", FEATURE, "--sign"], root, run).code).toBe(2);
  });

  it("exits 0 with a PASS line, 1 with a FAIL line listing what is missing", () => {
    expect(main(["expect-red", FEATURE], root, run)).toEqual({
      code: 0,
      output: "PASS expect-red F1: 1 teste(s), todos falhando",
    });
    const failed = main(["tests-reviewed", FEATURE], root, run);
    expect(failed.code).toBe(1);
    expect(failed.output).toMatch(/^FAIL tests-reviewed F1: testes sem revisão assinada\n {2}- estado sem `testShas`/);
  });
});
