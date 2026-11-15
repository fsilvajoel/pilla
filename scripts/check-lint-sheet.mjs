// Confere a cola do lint (docs/memoria/lint.md) contra o ESLint de verdade (LI-054):
// cada exemplo "errado" tem de acusar a regra citada, cada "certo" não pode acusá-la, e toda regra
// escrita à mão em packages/config/eslint.mjs (com cada mensagem de proibição) tem de ter exemplo.
// Uso: node scripts/check-lint-sheet.mjs [docs/memoria/lint.md]
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ESLint } from "eslint";
import { pillaEslint } from "../packages/config/eslint.mjs";

const SPAN = /(`+)(.+?)\1/;

export function parseSheet(text) {
  const entries = [];
  let section = null;
  let entry = null;
  for (const line of text.split("\n")) {
    const scope = /<!-- scope: (\w+) \| probe: (\S+)(?: \| suffix: (\S+))? -->/.exec(line);
    if (/^## /.test(line)) section = null;
    if (scope) section = { scope: scope[1], probe: scope[2], suffix: scope[3] ?? ".ts" };
    const rule = /^- `([^`]+)`: /.exec(line);
    if (rule && section) {
      entry = { ...section, rule: rule[1], bad: null, good: null };
      entries.push(entry);
    }
    const example = /^\s+- (errado|certo): (.+)$/.exec(line);
    if (example && entry) {
      const code = SPAN.exec(example[2])?.[2].trim() ?? null;
      if (example[1] === "errado") entry.bad = code;
      else entry.good = code;
    }
  }
  return entries;
}

/** Rules written by hand in the shared config (not the preset), with the ban messages of each one. */
export function ownRules(config) {
  const rules = new Map();
  for (const block of config) {
    if (!block.files || !block.rules || block.name?.startsWith("typescript-eslint/")) continue;
    for (const [name, value] of Object.entries(block.rules)) {
      const [level, ...options] = Array.isArray(value) ? value : [value];
      if (level === "off") continue;
      const messages = rules.get(name) ?? new Set();
      const collect = (o) => {
        if (Array.isArray(o)) o.forEach(collect);
        else if (o && typeof o === "object" && typeof o.message === "string") messages.add(o.message);
      };
      collect(options);
      rules.set(name, messages);
    }
  }
  return rules;
}

async function main(sheetPath) {
  const entries = parseSheet(readFileSync(sheetPath, "utf8"));
  const eslint = new ESLint();
  const problems = [];
  const seenMessages = new Set();
  const files = [];
  try {
    const jobs = [];
    entries.forEach((entry, i) => {
      for (const kind of ["bad", "good"]) {
        if (!entry[kind]) {
          problems.push(`${entry.rule} (${entry.scope}): falta o exemplo ${kind === "bad" ? "errado" : "certo"}`);
          continue;
        }
        const file = join(entry.probe, `zz-lint-sheet-${String(i)}-${kind}${entry.suffix}`);
        writeFileSync(file, entry[kind] + "\n");
        files.push(file);
        jobs.push({ entry, kind, file });
      }
    });
    const results = await eslint.lintFiles(files);
    for (const { entry, kind, file } of jobs) {
      const messages = results.find((r) => r.filePath.endsWith(file))?.messages ?? [];
      const hit = messages.filter((m) => m.ruleId === entry.rule);
      if (kind === "bad") {
        hit.forEach((m) => seenMessages.add(m.message));
        if (!hit.length) problems.push(`${entry.rule} (${entry.scope}): o exemplo errado não acusa a regra`);
      } else if (messages.length) {
        const list = messages.map((m) => m.ruleId ?? m.message).join(", ");
        problems.push(`${entry.rule} (${entry.scope}): o exemplo certo não passa no lint (${list})`);
      }
    }
  } finally {
    for (const file of files) rmSync(file, { force: true });
  }
  const covered = new Set(entries.map((e) => e.rule));
  for (const [rule, messages] of ownRules(pillaEslint)) {
    if (!covered.has(rule)) problems.push(`${rule}: está em packages/config/eslint.mjs e não está na cola`);
    for (const message of messages) {
      if (![...seenMessages].some((seen) => seen.includes(message)))
        problems.push(`${rule}: nenhum exemplo errado acusa "${message}"`);
    }
  }
  if (problems.length) {
    process.stderr.write(problems.join("\n") + "\n");
    process.exit(1);
  }
  process.stdout.write(`cola do lint ok: ${String(entries.length)} regras, exemplos conferidos no ESLint\n`);
}

if (process.argv[1]?.endsWith("check-lint-sheet.mjs")) await main(process.argv[2] ?? "docs/memoria/lint.md");
