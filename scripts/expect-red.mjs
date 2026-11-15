// Para cartões test-author: os testes novos precisam rodar e FALHAR contra a assinatura com throw (TDD vermelho).
// Uso: node scripts/expect-red.mjs <pasta do pacote> <arquivo de teste relativo ao pacote>
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [pkg, file] = process.argv.slice(2);
if (!pkg || !file) {
  process.stderr.write("uso: node scripts/expect-red.mjs <pacote> <arquivo.test.ts>\n");
  process.exit(2);
}
const dir = mkdtempSync(join(tmpdir(), "expect-red-"));
const out = join(dir, "report.json");
const run = spawnSync("pnpm", ["exec", "vitest", "run", file, "--reporter=json", `--outputFile=${out}`], {
  cwd: pkg,
  encoding: "utf8",
});
const report = existsSync(out) ? JSON.parse(readFileSync(out, "utf8")) : null;
rmSync(dir, { recursive: true, force: true });
if (!report || report.numTotalTests === 0) {
  process.stderr.write(
    `nenhum teste executado em ${file} (erro de importação ou sintaxe?)\n${run.stderr.slice(-800)}\n`,
  );
  process.exit(1);
}
if (report.numPassedTests > 0) {
  process.stderr.write(
    `${String(report.numPassedTests)} teste(s) passaram sem implementação: teste que não testa nada.\n`,
  );
  process.exit(1);
}
process.stdout.write(`vermelho ok: ${String(report.numTotalTests)} teste(s), todos falhando antes da implementação\n`);
