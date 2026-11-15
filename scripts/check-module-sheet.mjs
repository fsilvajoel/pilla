// Trava para cartões `docs` de ficha de módulo (LI-025): a ficha precisa citar todo nome exportado
// e todo ID de regra que o código do módulo cita. Também limita o tamanho (docs/memoria/modulos/_modelo.md).
// Uso: node scripts/check-module-sheet.mjs <ficha.md> <pasta src do módulo> [limite de palavras = 300]
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const [sheetPath, srcDir, limitArg = "300"] = process.argv.slice(2);
if (!sheetPath || !srcDir) {
  process.stderr.write("uso: node scripts/check-module-sheet.mjs <ficha.md> <src> [palavras]\n");
  process.exit(2);
}

const RULE_ID = /\b(?:RN-[A-Z]\d{2}|RF-\d{2}|T-\d{2}|CA-\d{2}[a-z]?)\b/g;
const sheet = readFileSync(sheetPath, "utf8");
const sources = readdirSync(srcDir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));

const ids = new Set();
for (const file of sources) {
  for (const id of readFileSync(join(srcDir, file), "utf8").match(RULE_ID) ?? []) ids.add(id);
}

const index = readFileSync(join(srcDir, "index.ts"), "utf8");
const exported = new Set();
for (const [, names] of index.matchAll(/export\s+(?:type\s+)?\{([^}]+)\}/g)) {
  for (const name of names.split(","))
    if (name.trim())
      exported.add(
        name
          .trim()
          .split(/\s+as\s+/)
          .pop(),
      );
}

const mentions = (word) => new RegExp(`(^|[^\\w-])${word.replace(/[-]/g, "\\-")}($|[^\\w-])`).test(sheet);
const missingIds = [...ids].filter((id) => !mentions(id)).sort();
const missingNames = [...exported].filter((name) => !mentions(name)).sort();
const words = sheet.split(/\s+/).filter(Boolean).length;
const limit = Number.parseInt(limitArg, 10);

const problems = [];
if (missingIds.length) problems.push(`IDs de regra citados no código e ausentes na ficha: ${missingIds.join(", ")}`);
if (missingNames.length) problems.push(`nomes exportados ausentes na ficha: ${missingNames.join(", ")}`);
if (words > limit) problems.push(`ficha com ${String(words)} palavras (limite ${String(limit)})`);

if (problems.length) {
  process.stderr.write(problems.join("\n") + "\n");
  process.exit(1);
}
process.stdout.write(`ficha ok: ${String(ids.size)} IDs, ${String(exported.size)} nomes, ${String(words)} palavras\n`);
