// Transforma a seção "## Evite" de uma cola de biblioteca (docs/memoria/libs/<lib>.md) num check:
// procura no código cada chamada à esquerda de "→" e lista onde aparece (LI-034).
// Uso: node scripts/check-avoid.mjs <cola.md> <pasta src>
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const [sheetPath, srcDir] = process.argv.slice(2);
if (!sheetPath || !srcDir) {
  process.stderr.write("uso: node scripts/check-avoid.mjs <cola.md> <pasta src>\n");
  process.exit(2);
}

const sheet = readFileSync(sheetPath, "utf8");
const avoid = /## Evite[^\n]*\n([\s\S]*?)(?=\n## |$)/.exec(sheet)?.[1] ?? "";
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const patterns = [];
for (const line of avoid.split("\n").filter((l) => /^\s*[-*]\s/.test(l))) {
  const left = line.split("→")[0] ?? "";
  for (const [, code] of left.matchAll(/`([^`]+)`/g)) {
    // "{...}", "..." e "Enum" viram curinga; o resto é literal
    const rx = escape(code)
      .replace(/\\\{\\\.\\\.\\\.\\\}/g, "[\\s\\S]*?")
      .replace(/\\\.\\\.\\\./g, "[\\s\\S]*?");
    patterns.push({ code, rx: new RegExp(rx) });
  }
}

const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) files.push(path);
  }
};
walk(srcDir);

const hits = [];
for (const file of files) {
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((text, i) => {
    for (const { code, rx } of patterns) {
      if (rx.test(text)) hits.push(`${file}:${String(i + 1)} usa \`${code}\` (a cola manda trocar)`);
    }
  });
}

if (hits.length) {
  process.stderr.write(hits.join("\n") + "\n");
  process.exit(1);
}
process.stdout.write(`evite ok: ${String(patterns.length)} padrões, ${String(files.length)} arquivos, 0 ocorrências\n`);
