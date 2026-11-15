// Itens mecânicos da pré-revisão dos esquemas viram check (LI-035, LI-050): o modelo só lê o resultado.
// S1 todo arquivo de src/api e src/events está exportado no index.ts
// S2 regex só em common.ts (as primitivas moram lá)
// S3 campo com sufixo de primitiva usa a primitiva de common.ts (Cents, Bps, Id, Date/At, cpf)
// Uso: node scripts/check-schemas.mjs <pasta src do pacote de esquemas>
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const FIELD_RULES = [
  { name: /Cents$/, value: /^\w*[cC]entsSchema\b/, use: "centsSchema, positiveCentsSchema ou signedCentsSchema" },
  { name: /Bps$/, value: /^bpsSchema\b/, use: "bpsSchema" },
  { name: /(Id|^id)$/, value: /^idSchema\b/, use: "idSchema" },
  { name: /(Date|^date)$/, value: /^isoDateSchema\b/, use: "isoDateSchema" },
  { name: /At$/, value: /^(isoDateSchema|instantSchema)\b/, use: "isoDateSchema ou instantSchema" },
  { name: /^cpf$/i, value: /^cpfSchema\b/, use: "cpfSchema" },
];
const REGEX_USE = /\.regex\(|new RegExp\(|\/[^/\s][^/\n]*\/[dgimsuvy]*\.(test|exec)\(/;
const FIELD_LINE = /^\s*(\w+):\s*(.+?),?\s*$/;
const SCHEMA_VALUE = /^(z\b|\w+Schema\b)/;

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.ts$/.test(name) && !/\.test\.ts$/.test(name) ? [path] : [];
  });
}

export function checkSchemas(srcDir) {
  const problems = [];
  const indexPath = join(srcDir, "index.ts");
  const index = existsSync(indexPath) ? readFileSync(indexPath, "utf8") : "";
  const files = walk(srcDir);
  for (const file of files) {
    const rel = relative(srcDir, file).replaceAll("\\", "/");
    if (rel === "index.ts" || rel === "common.ts") continue;
    const module = `./${rel.replace(/\.ts$/, "")}`;
    if (/^(api|events)\//.test(rel) && !index.includes(`from "${module}"`)) {
      problems.push(`${file}:1 S1 não está exportado em index.ts (falta: export * from "${module}";)`);
    }
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((text, i) => {
        const at = `${file}:${String(i + 1)}`;
        if (/^\s*(\/\/|\*|\/\*)/.test(text)) return;
        if (REGEX_USE.test(text)) problems.push(`${at} S2 regex fora de common.ts (use uma primitiva de common.ts)`);
        const field = FIELD_LINE.exec(text);
        if (!field || !SCHEMA_VALUE.test(field[2])) return;
        const rule = FIELD_RULES.find((r) => r.name.test(field[1]));
        if (rule && !rule.value.test(field[2])) {
          problems.push(`${at} S3 campo ${field[1]} usa \`${field[2]}\` (use ${rule.use} de common.ts)`);
        }
      });
  }
  return { problems, files: files.length };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replaceAll("\\", "/").split("/").pop())) {
  const srcDir = process.argv[2];
  if (!srcDir) {
    process.stderr.write("uso: node scripts/check-schemas.mjs <pasta src>\n");
    process.exit(2);
  }
  const { problems, files } = checkSchemas(srcDir);
  if (problems.length) {
    process.stderr.write(problems.join("\n") + "\n");
    process.exit(1);
  }
  process.stdout.write(`esquemas ok: S1 exports, S2 regex, S3 primitivas; ${String(files)} arquivos, 0 problemas\n`);
}
