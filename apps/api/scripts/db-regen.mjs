// Refaz do zero as migrações ainda não commitadas (idempotente) e falha de verdade: o drizzle-kit
// sai com código 0 mesmo quando o schema.ts quebra (LI-061).
import { spawnSync } from "node:child_process";

// O módulo é o schema do PostgreSQL e o nome do arquivo em drizzle-kit/ (RFC-005 §8); padrão: core.
// --dry-run só imprime os comandos git, sem executar nada (usado no teste).
const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const [name, module = "core"] = argv.filter((a) => a !== "--dry-run");
if (!name) {
  process.stderr.write("uso: node scripts/db-regen.mjs <nome-da-migracao> [modulo] [--dry-run]\n");
  process.exit(2);
}
// Só a pasta do módulo pedido: as migrações novas dos outros módulos ficam intactas.
const folder = `migrations/${module}`;
const gitSteps = [
  ["checkout", "--", folder],
  ["clean", "-fdq", folder],
];
if (dryRun) {
  for (const args of gitSteps) process.stdout.write(`git ${args.join(" ")}\n`);
  process.exit(0);
}
const run = (cmd, args) => spawnSync(cmd, args, { encoding: "utf8" });
// Módulo novo ainda não tem pasta no git: não há o que restaurar, só o que limpar.
const tracked = run("git", ["ls-files", "--", folder]).stdout.trim() !== "";
for (const args of tracked ? gitSteps : gitSteps.slice(1)) {
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
