# Cartão de tarefa

> Detalhe do [AGENTS.md](../../AGENTS.md). Todo trabalho começa por um cartão em `docs/plano/<entrega>.yaml`.

O cartão é o pedido inteiro que o agente recebe. Quem executa (a Alice, um modelo local) não vê a conversa, não
pergunta por hábito e segue o texto ao pé da letra. Por isso **cartão mal escrito vira falha de quem executa e
retrabalho dos dois lados**. Das 17 execuções que falharam ou pararam até 2026-11-15, cerca de metade foi por
erro do cartão ou do processo do Claude, não do modelo (ver "De onde vêm as regras").

## Formato

```yaml
id: E2-T20
title: Implement the allocationPreviewRequest body schema (POST /payments/allocation-preview)
kind: implement            # implement | test-author | pre-review | docs | cards | research
assignee: alice            # alice | claude | bia (bia só em kind test-author)
rules: []                  # IDs (RN-C03, T-13, CA-12): o harness injeta só estas definições
refs: [RFC-004 §3]         # lidas sob demanda com read_rule
dependsOn: [E2-T13]
allowedPaths:              # onde pode escrever (Alice: arquivos listados, até 2)
  - packages/schemas/src/api/payments/allocation-preview.ts
protectedTests:            # o teste que decide o pronto; ela nunca altera
  - packages/schemas/src/api/api.test.ts
generatedPaths:            # opcional: arquivos que um check gera (ex.: migração do drizzle-kit); ela não escreve neles (LI-060)
  - apps/api/migrations/core/*
readFirst:                 # tudo que ela precisa ler; arquivo citado no done tem de estar aqui
  - packages/schemas/src/api/lending/simulate-loan.ts
  - packages/schemas/src/common.ts
checks:                    # comandos sem shell; todos rodam no finish
  - pnpm --filter @pilla/schemas exec vitest run src/api/api.test.ts -t allocationPreviewRequest
  - pnpm --filter @pilla/schemas typecheck
  - pnpm --filter @pilla/schemas lint
done:                      # o resultado, conferível; uma instrução por linha
  - all allocationPreviewRequest tests in api.test.ts pass (vitest -t filter)
  - 'fields, exactly: loanId: idSchema; amountCents: positiveCentsSchema; paidAt: isoDateSchema'
  - export type AllocationPreviewRequest = z.infer<typeof allocationPreviewRequest>;
  - 'import line: import { idSchema, isoDateSchema, positiveCentsSchema } from "../../common"; never write a new regex'
hints:                     # como fazer; dica, não critério
  - one write_file or edit_file call; the file stays under 15 lines
budget: { attempts: 4, toolCalls: 20, minutes: 6 }
sizeNote: um corpo por cartão; o modelo é lending/simulate-loan.ts
```

Campos opcionais: `checklist` (só em `pre-review`: itens `<chave> descrição`), `libs` (colas de biblioteca além
das do pacote), `refactor` (rodada de limpeza depois de verde; padrão `true` em `implement`), `think` (raciocínio
estendido; padrão `false`), `maxOutputTokens`, e em `research`: `question` e `why: { category, reason }`.
Campo com nome desconhecido reprova a validação (antes era ignorado em silêncio).

## Regras para quem escreve o cartão

Valem para o Claude e para qualquer agente que planeje cartões. A coluna "Máquina" diz quem confere:
**V** = `alice.py cards` (validação, antes de qualquer execução); **P** = pré-voo do `alice.py run` (antes de o
modelo gastar qualquer coisa); **—** = só a leitura de quem escreve.

### O pronto (`done`) e os `checks`

| # | Regra | Por quê | Máquina |
|---|---|---|---|
| 1 | Cada linha do `done` é um **resultado conferível**: um teste que passa, um nome exportado, um valor exato. Técnica de edição ("uma chamada de edit_file") vai em `hints`. | dica misturada com critério confunde o que decide o pronto (LI-029) | V |
| 2 | Tudo que o `done` pede e o teste não vê ganha um **check** (script que diz o que falta) ou uma **linha de código literal**. | critério sem trava de máquina é ignorado (LI-025, LI-032, LI-042) | — |
| 3 | Código literal no `done` (`export type …;`, `import { … } from "…";`) vai **completo, terminado em `;`, sem texto no meio**. Assinatura de função vai em prosa, sem `export function`. | o portão exige a linha exata até o primeiro `;` (LI-051) | V |
| 4 | Mudança em **mais de um lugar** ("os dois refines", "todo arquivo"): liste cada lugar e ponha um check que conte (`scripts/check-count.mjs`). | o modelo muda um lugar e os testes passam (LI-051) | — |
| 5 | Diga o **valor exato**: `amountCents: positiveCentsSchema`, não "amountCents (> 0)". | descrição indireta obriga o modelo a adivinhar a primitiva (lote E2-T14..T22: tudo de primeira com o valor exato) | — |
| 6 | "Reusar X" vem com a **linha de import** de X. | sem ela o modelo copia X (LI-030) | V |
| 7 | Todo arquivo citado no `done` está em `allowedPaths`, `protectedTests` ou `readFirst`, **com o caminho**. | o modelo não acha `_modelo.md` sozinho (LI-024) | V |
| 8 | Regra de negócio citada no texto (RN-…, T-…, CA-…) está em `rules`. | só o que está em `rules` é injetado (LI-004) | V |
| 9 | Cartão de código TypeScript tem check de **teste, typecheck e lint**. | o lint é parte do pronto, não surpresa do commit (LI-054) | V |
| 10 | Check roda **sem shell** (nada de `\|`, `&&`, `>`), o comando existe e **explica a falha** (nada de `node -e` mudo). | check que só devolve "exit 1" não orienta ninguém (LI-055) | V, P |
| 11 | Antes de começar, **algum check está vermelho**; depois de pronto, todos verdes. | se tudo já passa, nenhum check distingue pronto de não pronto (LI-025) | P |
| 12 | Uma linha do `done` tem até 220 caracteres e uma instrução só. | linha longa esconde a segunda instrução | V |

### Tamanho e orçamento

| # | Regra | Por quê | Máquina |
|---|---|---|---|
| 13 | Cartão da Alice: até **2 arquivos listados** (sem curinga), **uma função** (ou até 3 triviais). A parte algorítmica difícil vem pronta e testada. | arquivo grande quebra a chamada de ferramenta; cartão grande roda 25 min e falha (LI-011, LI-016) | V |
| 14 | `budget.toolCalls` ≥ 8 + 3 por check (e ≤ 30); `attempts` ≤ 6; `minutes` ≤ 15. | E2-T24: 5 checks, 23 chamadas, orçamento de 20 | V |
| 15 | O esboço que o cartão manda preencher compila, não tem marca de tipo só declarada nem auxiliar que force ramo impossível. | E1-T21 e E1-T22 falharam por causa do esboço do Claude (LI-016, LI-018) | — |
| 16 | Arquivos de `readFirst` e `protectedTests` existem (ou um cartão anterior cria). | caminho errado custa chamadas até o modelo desistir | V, P |

### Pré-revisão (`pre-review`)

| # | Regra | Por quê | Máquina |
|---|---|---|---|
| 17 | Sempre com `checklist` fechado, chaves únicas, um item por verificação. | revisão aberta devolve "sem achados" (LI-013) | V |
| 18 | Item **mecânico** (toda linha, todo arquivo, nenhum uso de X) vira **check**, e o item cita o check: `…; run_check 2 (rule S1) proves it`. Check com várias regras: cite a regra do item, porque o harness confere o veredito só contra ela ("ok" com a regra acusada e "falta" sem nada acusado são recusados). | o modelo não acha o que é mecânico lendo código; "ok" com prova que não sustenta passava; sem a regra, o vermelho de um item derrubava os outros (LI-035, LI-050, LI-053, LI-059) | V |
| 19 | Fica para o modelo só o que exige leitura: nomes contra o glossário, sentido contra a RFC. | é onde ele rende | — |

### Processo de quem planeja

| # | Regra | Por quê | Máquina |
|---|---|---|---|
| 20 | Antes da fila: `alice.py cards docs/plano/<entrega>.yaml --repo .` sem problemas. | 26 problemas apareceram nos cartões antigos da Alice quando as regras acima viraram validação | V |
| 21 | Árvore limpa antes do `run` e do `resume`; ninguém edita o repositório enquanto a Alice roda ou está pausada. | arquivo alheio vira "fora do escopo" na conta dela (LI-009, LI-051) | P |
| 22 | Falhou? Antes de rodar de novo, classifique: **cartão**, **harness** ou **modelo**. Cartão e harness se corrigem com regra nesta página ou trava nova; só o que sobra é do modelo. | repetir a execução sem corrigir a causa só gasta GPU e turnos | — |
| 23 | Lote novo começa por **um** cartão; o resto da fila só depois de ele passar de primeira. | erro de molde se repete em todos os cartões do lote (LI-041: 3 arquivos com o mesmo defeito) | — |

### Uma leva por sessão (15/11/2026)

- **Uma sessão nova do Claude por leva.** O Claude entra só no começo (cartão, `alice.py cards`) e no fim (ler o
  `runs/retro-*.md`, decidir e commitar). No meio, `alice.py plan-run <plano> <ID>... --rounds N` repete sozinho
  execução → checks → revisão → nova rodada com as notas, até aprovar ou acabar N (`escalated`; dependentes pulados).
  O plan-run nunca commita.
- **Conserto de harness em sessão própria**, nunca durante uma entrega (harness congelado enquanto a Alice ou a Bia
  rodam).
- **A Alice compensa** quando os turnos do Claude para supervisionar ficam abaixo dos turnos para fazer sozinho;
  medir com `alice.py cost <ID>`. Motivo: o E4-T03 orquestrado à mão custou 330 turnos e ≈5M tokens em 10 rodadas,
  64% em releitura de contexto (custo ∝ turnos × contexto).

### Feature (16/11/2026, ADR-0014)
Cartões test-author (assignee bia) e implement (assignee alice) da mesma entrega formam uma feature no bloco
`features:` do plano YAML (`id: E<n>-F<nn>`, `cards`, `biaBudget` de 2 a 6), com o plano em
`docs/plano/<F>/plano.md` (Escopo, Riscos, Dependências, Critérios de aceite `- A<n>:`, Cenários `- C<n>:`).
O `protectedTests` do implement sai dos `allowedPaths` dos test-author da feature. `alice.py cards` confere tudo.
Fluxo, esquemas e a tabela de critérios de decisão: [orquestracao.md](orquestracao.md).

## O que o ambiente faz sozinho (não peça no cartão)

- **Formata** com o Prettier os arquivos tocados, antes dos checks (LI-052).
- Põe no pedido a **cola do lint** ([docs/memoria/lint.md](../memoria/lint.md)) só com as seções dos arquivos do cartão,
  e as **colas de biblioteca** do pacote. Não repita no `done` "sem any", "sem Math", "use z.int()".
- Confere escopo (`allowedPaths`), marcadores proibidos, frase `ESBOÇO` restante, duplicação de 6+ linhas e diff vazio.
- Em `pre-review`: uma linha por item, evidência que existe, e "ok" recusado quando o check do item está vermelho.

## O pedido que a Alice recebe

Montado por `Run.system_prompt` a partir do cartão, em seções fixas:

```
# TAREFA <id>: <title>          tipo, regras injetadas, referências
# ARQUIVOS                      onde escreve, o que é protegido, o que ler primeiro
# PRONTO QUANDO                 uma linha do done por tópico; depois hints; depois os checks numerados
# REGRAS DE CÓDIGO              código em inglês e comentário em pt-BR, não inventar API, cola do lint, notas do pacote, colas de biblioteca
# FERRAMENTAS                   qual ferramenta para qual edição
# FLUXO                         a ordem dos passos, por tipo de tarefa
```

Regras para quem mexe nesse texto: uma instrução por linha; nada que o modelo não consiga cumprir; nada que o
ambiente contradiga (o pedido dizia "máx. 400 linhas" e o ambiente recusava acima de 150); o que decide o pronto
vem antes de como fazer.

## Colas (`docs/memoria/`)

O modelo local conhece versões antigas das bibliotecas e não conhece as regras do lint do projeto.

| Cola | Conteúdo | Conferida por |
|---|---|---|
| `libs/<lib>.md` | "Use" e "Evite" da biblioteca (≤ 400 palavras), rascunhada pela Alice da documentação oficial e revisada pelo Claude | `scripts/check-lib-sheet.mjs` executa cada chamada citada; `scripts/check-avoid.mjs` procura a lista "Evite" no código |
| `lint.md` | regras do ESLint por escopo, com exemplo errado e certo | `scripts/check-lint-sheet.mjs` roda o ESLint em cada exemplo e cobra toda regra escrita à mão em `packages/config/eslint.mjs` |

Versão nova da biblioteca ou regra nova no ESLint = rodar o check e revisar a cola (`pnpm verify` roda os dois).

## Pesquisa externa (`kind: research`)

Custa busca, tempo e risco (texto da web é dado não confiável), então só com **bom motivo**: o fato **não está no
repositório** e a resposta **muda uma decisão ou um código**. Categorias aceitas em `why.category`:

| Categoria | Exemplo |
|---|---|
| `regulation` | regra do Banco Central ou lei que limita juros ou multa |
| `external-spec` | especificação do Pix ou formato de um arquivo bancário |
| `lib-behavior` | comportamento de uma biblioteca que a cola não cobre |
| `security-advisory` | alerta de segurança de uma dependência |

Não é motivo: regra de negócio (pergunte ao Claude ou ao Joel), dúvida que o código ou a RFC respondem, curiosidade.
O cartão exige `question` (uma pergunta fechada), `why.reason` (≥ 30 caracteres) e um único arquivo em `docs/pesquisa/`.
O resultado tem as seções Pergunta, Resposta (até 5 tópicos com fonte oficial) e Não encontrado, conferidas por
`scripts/check-research.mjs`. Domínio novo entra em `.agents/policy.yaml` por PR revisado pelo Joel.

## De onde vêm as regras

Leitura das 62 execuções registradas até 2026-11-15 (45 prontas, 9 falhas, 8 pausas), pelas lições de cada uma:

| Causa | Execuções | Exemplos |
|---|---|---|
| Cartão ou processo do Claude | 8 | cartão grande demais e esboço com defeito (E1-T21, E1-T22), cartão sem fonte (E1-T20), "reuse" sem import (E2-T08), check do Claude com erro (E2-T12), linha do done impossível e edição durante a pausa (E2-T24, 2×), edição durante a execução (E-02) |
| Harness (ferramenta ou portão) | 8 | as 7 passadas da pré-revisão E2-T11 que não fecharam (LI-033 a LI-040) e a H-02 (LI-005) |
| Modelo | 1 | E1-T12 (testes incompletos, LI-017) |

A classificação é do Claude, a partir de `docs/memoria/licoes.md`; os números de execução vêm de `runs/metrics.jsonl`.
Daqui em diante o pré-voo grava `card_error` nas métricas, e a conta passa a ser medida, não lida.
