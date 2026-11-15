// Refaz do zero as migrações ainda não commitadas (idempotente) e falha de verdade: o drizzle-kit
// sai com código 0 mesmo quando o schema.ts quebra (LI-061).
import { spawnSync } from "node:child_process";

// O módulo é o schema do PostgreSQL e o nome do arquivo em drizzle-kit/ (RFC-005 §8); padrão: core.
const [name, module = "core"] = process.argv.slice(2);
if (!name) {
  process.stderr.write("uso: node scripts/db-regen.mjs <nome-da-migracao> [modulo]\n");
  process.exit(2);
}
const run = (cmd, args) => spawnSync(cmd, args, { encoding: "utf8" });
for (const args of [
  ["checkout", "--", "migrations"],
  ["clean", "-fdq", "migrations"],
]) {
  const r = run("git", args);
  if (r.status !== 0) {
    process.stderr.write(`git ${args.join(" ")} falhou:\n${r.stderr}`);
    process.exit(1);
  }
}
const r = run("drizzle-kit", ["generate", "--config", `drizzle-kit/${module}.config.ts`, "--name", name]);
const out = `${r.stdout}\n${r.stderr}`;
const error = out.split("\n").find((l) => /^\s*\w*Error\b/.test(l));
if (r.status !== 0 || error) {
  const at = out.split("\n").find((l) => l.includes("schema.ts:"));
  process.stderr.write(
    `drizzle-kit falhou: ${error ?? `exit ${r.status}`}\n` +
      (at ? `  em ${at.trim()}\n` : "") +
      "  rode o typecheck primeiro: ele mostra o erro do schema.ts com arquivo:linha.\n",
  );
  process.exit(1);
}
if (!/migration file/i.test(out) && !/No schema changes/i.test(out)) {
  process.stderr.write(`drizzle-kit não gerou migração:\n${out}`);
  process.exit(1);
}
process.stdout.write(
  out
    .split("\n")
    .filter((l) => /tables?|columns|migration|No schema/i.test(l))
    .join("\n") + "\n",
);
