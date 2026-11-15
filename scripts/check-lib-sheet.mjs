// Trava das colas de biblioteca (docs/memoria/libs/<lib>.md): toda chamada `z.algo(...)` citada precisa
// existir na versão instalada, a cola cita a documentação oficial e é curta (entra no contexto de todo cartão).
// Uso: node scripts/check-lib-sheet.mjs <cola.md> <pasta do pacote que usa a lib> <módulo> <prefixo> <domínio> [palavras = 400]
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const [sheetPath, pkgDir, moduleName, prefix, domain, limitArg = "400"] = process.argv.slice(2);
if (!sheetPath || !pkgDir || !moduleName || !prefix || !domain) {
  process.stderr.write(
    "uso: node scripts/check-lib-sheet.mjs <cola.md> <pacote> <módulo> <prefixo> <domínio> [palavras]\n",
  );
  process.exit(2);
}

const sheet = readFileSync(sheetPath, "utf8");
const require = createRequire(join(resolve(pkgDir), "package.json"));
const lib = await import(pathToFileURL(require.resolve(moduleName)).href);
const root = lib[prefix] ?? lib.default ?? lib;

// Só cadeias de acesso e chamadas com argumentos literais (números, strings, booleanos): nada de código arbitrário.
const literal = String.raw`(?:-?\d+(?:\.\d+)?|"[^"\\]*"|'[^'\\]*'|true|false)`;
const args = String.raw`\((?:${literal}(?:\s*,\s*${literal})*)?\)`;
const chain = new RegExp(String.raw`\b${prefix}(?:\.[A-Za-z_$][\w$]*(?:${args})?)+`, "g");

const broken = [];
const seen = new Set();
for (const match of sheet.matchAll(chain)) {
  const expr = match[0];
  // `z.infer<...>` e afins são só tipo (somem em tempo de execução): o tsc confere esses, não este script (LI-031)
  if (sheet[match.index + expr.length] === "<" || seen.has(expr)) continue;
  seen.add(expr);
  try {
    const value = new Function(prefix, `return ${expr};`)(root);
    if (value === undefined) broken.push(`${expr} → undefined`);
  } catch (error) {
    broken.push(`${expr} → ${error instanceof Error ? error.message : String(error)}`);
  }
}

const words = sheet.split(/\s+/).filter(Boolean).length;
const limit = Number.parseInt(limitArg, 10);
const problems = [];
if (broken.length) problems.push(`APIs que não existem na versão instalada:\n  ${broken.join("\n  ")}`);
if (!sheet.includes(`https://${domain}`)) problems.push(`cite a documentação oficial (https://${domain}/...)`);
if (seen.size < 5) problems.push(`só ${String(seen.size)} exemplos de API; mostre o uso certo com código`);
const avoid = /## Evite[^\n]*\n([\s\S]*?)(?=\n## |$)/.exec(sheet)?.[1] ?? "";
const avoidItems = avoid.split("\n").filter((l) => /^\s*[-*]\s/.test(l)).length;
if (avoidItems < 3)
  problems.push(
    `"## Evite" com ${String(avoidItems)} itens; liste ao menos 3 hábitos do zod 3 → chamada certa (LI-032)`,
  );
if (words > limit) problems.push(`cola com ${String(words)} palavras (limite ${String(limit)})`);

if (problems.length) {
  process.stderr.write(problems.join("\n") + "\n");
  process.exit(1);
}
process.stdout.write(`cola ok: ${String(seen.size)} APIs conferidas, ${String(words)} palavras\n`);
