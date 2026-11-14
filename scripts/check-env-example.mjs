// travas §7: toda variável usada no código (process.env.X) existe no .env.example; o .env local não tem chave a mais nem a menos.
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const keys = (file) =>
  new Set(
    readFileSync(file, "utf8")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#") && l.includes("="))
      .map((l) => l.split("=")[0].trim()),
  );
if (!existsSync(".env.example")) {
  process.stderr.write(".env.example ausente\n");
  process.exit(1);
}
const example = keys(".env.example");
const used = new Set();
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    if (["node_modules", "dist", "coverage", ".turbo", ".next", "reports"].includes(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|tsx|mjs)$/.test(name))
      for (const m of readFileSync(p, "utf8").matchAll(/process\.env\.([A-Z0-9_]+)/g)) used.add(m[1]);
  }
};
for (const d of ["apps", "packages"]) if (existsSync(d)) walk(d);
const problems = [...used].filter((k) => !example.has(k)).map((k) => `usada no código e ausente do .env.example: ${k}`);
if (existsSync(".env")) {
  const local = keys(".env");
  for (const k of example) if (!local.has(k)) problems.push(`no .env.example e ausente do .env: ${k}`);
  for (const k of local) if (!example.has(k)) problems.push(`no .env e ausente do .env.example: ${k}`);
}
if (problems.length) {
  process.stderr.write(problems.map((p) => `  - ${p}`).join("\n") + "\n");
  process.exit(1);
}
process.stdout.write(`env ok (${example.size} variáveis no .env.example, ${used.size} usadas no código)\n`);
