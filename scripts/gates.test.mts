import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { main, packageOf, productionFile, runGate, spawnRunner, type RunResult, type Runner } from "./gates.mts";

const FEATURE = "F1";
const TEST_FILE = "pkg/src/a.test.ts";
const PROD_FILE = "pkg/src/a.ts";
const NOW = new Date("2026-11-17T12:00:00.000Z");

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
  writeState({ feature: FEATURE, tests: [TEST_FILE] });
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
    writeState({ feature: FEATURE, tests: [TEST_FILE], gates: { "expect-red": { status: "PASS" } } });
    expect(runGate("tests-reviewed", { root, feature: FEATURE, run: git, sign: true }).pass).toBe(true);
    const sha = spawnRunner("git", ["hash-object", TEST_FILE], root).stdout.trim();
    expect(readStateFile()["testShas"]).toEqual({ [TEST_FILE]: sha });
    expect(runGate("tests-reviewed", { root, feature: FEATURE, run: git }).pass).toBe(true);
  });

  it("fails naming the file when a reviewed test changed", () => {
    writeState({ feature: FEATURE, tests: [TEST_FILE], gates: { "expect-red": { status: "PASS" } } });
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
    writeState({ feature: FEATURE, tests: [TEST_FILE, "pkg/src/b.test.ts"], testShas: { [TEST_FILE]: sha } });
    const outcome = runGate("tests-reviewed", { root, feature: FEATURE, run: git });
    expect(outcome.problems).toEqual(["pkg/src/b.test.ts: sem sha assinado (teste novo precisa de revisão e --sign)"]);
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
