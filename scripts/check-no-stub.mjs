// Check de cartão que tira o stub: fica vermelho enquanto alguma linha de um dos arquivos citar "stub <ID>"
// (o '// @stub <ID>' do código ou a exclusão '// stub <ID>' do vitest.config.ts), e verde quando nenhuma cita (LI-025).
// Uso: node scripts/check-no-stub.mjs <ID do cartão> <arquivo>...
import { readFileSync } from "node:fs";

const [id, ...files] = process.argv.slice(2);
if (!id || !/^E\d+-T\d+$/.test(id) || files.length === 0) {
  process.stderr.write("uso: node scripts/check-no-stub.mjs <ID do cartão, ex. E6-T02> <arquivo>...\n");
  process.exit(2);
}
const marker = new RegExp(`\\bstub ${id}\\b`);
const hits = files.flatMap((file) =>
  readFileSync(file, "utf8")
    .split("\n")
    .flatMap((line, i) => (marker.test(line) ? [`${file}:${String(i + 1)}: ${line.trim()}`] : [])),
);
if (hits.length > 0) {
  process.stderr.write(`ainda há marca de stub ${id}; apague cada linha abaixo:\n${hits.join("\n")}\n`);
  process.exit(1);
}
process.stdout.write(`nenhuma marca de stub ${id} em ${files.join(", ")}\n`);
