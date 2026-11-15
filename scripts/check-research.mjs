// Trava dos cartões `research` (docs/pesquisa/*.md): resumo curto, com as seções fixas, e cada tópico
// da resposta com a URL https de um domínio oficial de .agents/policy.yaml.
// Uso: node scripts/check-research.mjs <resumo.md> [palavras = 300]
import { readFileSync } from "node:fs";

const [path, limitArg = "300"] = process.argv.slice(2);
if (!path) {
  process.stderr.write("uso: node scripts/check-research.mjs <resumo.md> [palavras]\n");
  process.exit(2);
}

const text = readFileSync(path, "utf8");
const policy = readFileSync(".agents/policy.yaml", "utf8");
const block = /officialDomains:\n((?:\s+-\s+\S+\n)+)/.exec(policy)?.[1] ?? "";
const domains = [...block.matchAll(/-\s+(\S+)/g)].map((m) => m[1]);
const official = (url) => {
  const host = new URL(url).hostname;
  return domains.some((d) => host === d || host.endsWith(`.${d}`));
};

const problems = [];
for (const heading of ["## Pergunta", "## Resposta", "## Não encontrado"]) {
  if (!text.includes(heading)) problems.push(`falta a seção "${heading}"`);
}
const answer = /## Resposta\n([\s\S]*?)(?=\n## |$)/.exec(text)?.[1] ?? "";
const bullets = answer.split("\n").filter((l) => /^\s*[-*]\s/.test(l));
if (bullets.length === 0 || bullets.length > 5)
  problems.push(`a resposta precisa de 1 a 5 tópicos (tem ${String(bullets.length)})`);
for (const line of bullets) {
  const urls = line.match(/https:\/\/[^\s)>\]]+/g) ?? [];
  if (!urls.some(official)) problems.push(`tópico sem fonte oficial: ${line.trim().slice(0, 80)}`);
}
const words = text.split(/\s+/).filter(Boolean).length;
const limit = Number.parseInt(limitArg, 10);
if (words > limit) problems.push(`resumo com ${String(words)} palavras (limite ${String(limit)})`);

if (problems.length) {
  process.stderr.write(problems.join("\n") + "\n");
  process.exit(1);
}
process.stdout.write(`pesquisa ok: ${String(bullets.length)} tópicos com fonte, ${String(words)} palavras\n`);
