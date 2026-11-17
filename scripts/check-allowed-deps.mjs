// travas §7: falha se algum package.json usar dependência fora da lista de docs/travas.md ("Dependências permitidas").
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const doc = readFileSync("docs/travas.md", "utf8");
const section = doc.split(/^# Dependências permitidas/m)[1] ?? "";
const allowed = [...section.matchAll(/`([^`\s]+)`/g)]
  .map((m) => m[1])
  .filter((n) => /^(@[a-z0-9-]+\/)?[a-z0-9.*-]+$/.test(n));
if (allowed.length === 0) throw new Error("lista de dependências permitidas não encontrada em docs/travas.md");
const ok = (name) =>
  name.startsWith("@pilla/") || allowed.some((a) => (a.endsWith("/*") ? name.startsWith(a.slice(0, -1)) : a === name));

const manifests = ["package.json"];
for (const dir of ["apps", "packages"]) {
  if (!existsSync(dir)) continue;
  for (const d of readdirSync(dir))
    if (existsSync(join(dir, d, "package.json"))) manifests.push(join(dir, d, "package.json"));
}
const bad = [];
for (const file of manifests) {
  const pkg = JSON.parse(readFileSync(file, "utf8"));
  for (const field of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
    for (const name of Object.keys(pkg[field] ?? {})) if (!ok(name)) bad.push(`${file}: ${name} (${field})`);
  }
}
if (bad.length) {
  process.stderr.write(
    `Dependências fora da lista permitida (pedir ao Claude/Joel):\n${bad.map((b) => `  - ${b}`).join("\n")}\n`,
  );
  process.exit(1);
}
process.stdout.write(`dependências ok (${manifests.length} package.json, ${allowed.length} permitidas)\n`);
