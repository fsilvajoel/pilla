// Conta quantas vezes um texto aparece num arquivo e compara com o esperado. Serve de check de cartão quando
// o teste não vê a diferença (ex.: "a soma copiada sumiu daqui"), dizendo o que falta em vez de só falhar.
// Uso: node scripts/check-count.mjs <arquivo> <texto literal> <vezes esperadas>
import { readFileSync } from "node:fs";

const [file, text, expected] = process.argv.slice(2);
if (!file || !text || !/^\d+$/.test(expected ?? "")) {
  process.stderr.write("uso: node scripts/check-count.mjs <arquivo> <texto> <vezes esperadas>\n");
  process.exit(2);
}
const lines = readFileSync(file, "utf8").split("\n");
const hits = lines.flatMap((line, i) => Array(line.split(text).length - 1).fill(i + 1));
if (hits.length !== Number(expected)) {
  const where = hits.length ? ` (linhas ${hits.join(", ")})` : "";
  process.stderr.write(`${file}: "${text}" aparece ${String(hits.length)}x${where}; o cartão pede ${expected}x\n`);
  process.exit(1);
}
process.stdout.write(`${file}: "${text}" aparece ${expected}x, como pedido\n`);
