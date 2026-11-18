# Lições

Só as lições que ainda valem para o código e as travas do pilla. As do harness antigo (motor Python, cartões)
saíram com ele em 17/11/2026 ([ADR-0015](../adr/0015-harness-ada-externo-agnostico.md)); os IDs não são reusados.

| ID | Data | Lição | Origem |
|---|---|---|---|
| LI-008 | 2026-11-14 | Teste de regex precisa de casos que distinguem o padrão certo de um parecido: uma regex corrompida passou no teste por coincidência. | H-02 |
| LI-014 | 2026-11-14 | TypeScript 7 (reescrita em Go) é o `latest`, mas o typescript-eslint só aceita < 6.1: fixar `typescript@~6.0` até o ecossistema acompanhar. pnpm 12 bloqueia scripts de instalação: declarar em `allowBuilds` do pnpm-workspace.yaml. | E0 |
| LI-018 | 2026-11-14 | Auxiliar de núcleo para dado já validado não deve ter ramo: um `parseParts` que devolvia `null` obrigou checagens que nunca executam e travou a cobertura de 100% (virou `civilOf`). | E1 |
| LI-019 | 2026-11-14 | O arredondamento foi reimplementado em vez de reusar `roundToStep` (regra duplicada): a revisão pede reuso de função existente. | E1 |
| LI-020 | 2026-11-14 | 1ª mutação do motor: 89,0% (meta 90); os buracos estavam em testes escritos à mão (meses de 30 dias, século, sinal com centavos) e houve conta errada em teste (367 em vez de 366 dias). Depois de reforçar: 94,2%. Teste de mutação e verificação cruzada valem para todo autor. Mutação entrou no CI. | E1 |
| LI-027 | 2026-11-14 | `centsSchema.refine(v => v >= 0n)` repete a primitiva e compara com bigint, e o teste verde não pegou (o refine é inócuo). Nos esquemas, dinheiro é inteiro no fio: use as primitivas de `common.ts`. | E2-T02 |
| LI-034 | 2026-11-15 | A cola de biblioteca (`docs/memoria/libs/`) só ajuda se chega a quem escreve o código; citada na tarefa, ela tem de ir junto no contexto. | E2-T11 |
| LI-035 | 2026-11-15 | Hábito do zod 3 lendo o código não foi achado na revisão. A lista "Evite" da cola virou check (`scripts/check-avoid.mjs`): o que é mecânico vai para script, não para o modelo. | E2-T11 |
| LI-046 | 2026-11-15 | A soma das alocações estava copiada entre `payment-confirmed` e `payment-reversed`: 6+ linhas iguais em dois arquivos viram import, não cópia. | E2 |
| LI-050 | 2026-11-15 | Com 4 defeitos plantados nos esquemas, a revisão por modelo confere se a prova existe, não se ela sustenta o veredito ("ok — index.ts:14-23" não prova ausência). O defeito coberto por check foi o mais achado: itens mecânicos de revisão viram check. | bancada |
| LI-053 | 2026-11-15 | Aplicação da LI-050: `scripts/check-schemas.mjs` (S1 exports no `index.ts`, S2 regex só em `common.ts`, S3 campo com sufixo usa a primitiva) pega 4 de 4 defeitos plantados e achou um caso real (`z.int().refine` solto virou `signedCentsSchema`). Entrou no `pnpm verify`. | bancada, LI-050 |
| LI-054 | 2026-11-15 | Resumir o lint numa linha deu regra errada (proibia `Math`, `Number` e `new Date` em todo TypeScript, quando só vale no código puro). Agora existe a cola do lint (`docs/memoria/lint.md`) com exemplo errado e certo por escopo, conferida por `scripts/check-lint-sheet.mjs`. | pedido do Joel |
| LI-057 | 2026-11-15 | Comentário de código: a ADR-0012 pede pt-BR (decisão do Joel, 2026-11-15). Comentários em inglês mudam quando o trecho for alterado. | revisão 2026-11-15 |
| LI-061 | 2026-11-15 | O `drizzle-kit generate` sai com código 0 mesmo quando o schema.ts quebra. `apps/api/scripts/db-regen.mjs` falha de verdade com uma linha de erro e aponta o typecheck. Regra: ferramenta que gera arquivo precisa de embrulho que confira a saída, não só o código de saída. | E3-T01 |
| LI-066 | 2026-11-16 | Cenário de regressão (que já passa contra o HEAD) nunca entra num arquivo de teste novo sujeito ao gate expect-red, que exige o arquivo inteiro falhando: ele fica no teste antigo. | E4-F03 |
| LI-067 | 2026-11-16 | Lending (RFC-005 §4): o CHECK `installment_count >= 1 OR (installment_count IS NULL AND type = 'INTEREST_ONLY')` aceitava contrato parcelado sem parcelas, porque `NULL >= 1` dá NULL e CHECK com NULL passa. Em coluna que aceita nulo, CHECK com comparação leva `IS NOT NULL` explícito, e o teste de contrato insere NULL em cada caso que deve ser recusado. | lending |
