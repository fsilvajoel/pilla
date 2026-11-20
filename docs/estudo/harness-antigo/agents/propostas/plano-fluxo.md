# Plano 1: fluxo de desenvolvimento que não para

> Proposta, 17/11/2026. Ainda não está em vigor. Só vale depois que o Joel aprovar.
> Os itens marcados **[JOEL]** são decisões dele.

## Resumo (celular)

1. Em 3 dias, 62% dos commits foram de harness e 25% de produto. No dia 17 houve 11 execuções reais da Alice: 2 deram certo e 9 estouraram as chamadas.
2. O tempo parado vem de três causas: harness mudando durante a leva (v8 a v15 em 2 h), cartões grandes demais para o 9B e espera por decisões.
3. Proposta: um **trem diário**.
   - De manhã, o harness congela, numa versão só por dia.
   - Depois roda a leva com os cartões que estão "prontos".
   - À noite há retro e correção.
   - Nada muda no harness durante a leva.
4. O destrave não espera ninguém. Cartão que falhou 2× volta para o refinamento. Ele não volta para o harness.
5. Cada cartão tem um teto. Acima dele, a Alice "não compensa" e o cartão vai para um caminho decidido pelo Joel antes da leva, não durante.
6. Métricas no quadro:
   - cartões done por dia;
   - horas paradas;
   - % de commits de harness.
   - Meta da semana: 8 ou mais done por dia e harness abaixo de 25%.
7. Há 6 decisões do Joel no fim do documento.

---

## 1. Diagnóstico: para onde vai o tempo

### 1.1 Commits por área (git log, 200 commits entre 14 e 17/11)

| Dia | harness (alice + jorge) | produto (apps, packages) | plano | outro |
|---|---|---|---|---|
| 14/11 | 24 | 10 | — | 10 |
| 15/11 | 59 | 27 | 5 | 2 |
| 16/11 | 34 | 8 | 6 | 3 |
| 17/11 | 6 | 4 | 2 | — |
| **total** | **123 (62%)** | **49 (25%)** | 13 | 15 |

Linhas alteradas por área:

| Área | Linhas |
|---|---|
| produto | 10.597 |
| alice-harness | 8.458 |
| jorge | 6.302 |
| docs de agentes | 5.507 |
| plano | 5.157 |

Somando harness, Jorge, docs de agentes e plano, a **máquina de produzir** recebeu 2,4× mais linhas do que o produto. O harness em Python tem 4.736 linhas. O TypeScript de produto tem 7.015.

### 1.2 Execuções da Alice (`tools/alice-harness/runs/metrics.jsonl`)

| Dia | done | failed | needs_input | prompt tokens |
|---|---|---|---|---|
| 15/11 | 14 | 3 | 3 | 9,3M |
| 16/11 | 4 | 4 | 1 | 8,7M |
| 17/11 | 2 | 50 | 0 | 4,1M |

- Das 52 execuções de 17/11, 41 são `E9-X`, testes do próprio harness gravando na métrica real. **A métrica está contaminada** (brecha 2.9).
- Sobram 11 execuções de produto: E6-T02 com 2 done; E6-T02, E6-T04, E6-T06, E6-T07, E7-T09 e E7-T10 com 9 falhas, **todas no teto de toolCalls**.
- Cartões entregues pela Alice com rodapé `Card-Done`: E4-T03, T04, T05, T08 e T09, todos em 16/11. Nas leva das telas (E6/E7) foram **0 cartões**.

### 1.3 Custo do Claude (memórias com medição pelo transcript)

| Episódio | Claude | Comparação |
|---|---|---|
| Rodada people | 776k | 309k se fosse feito direto (2,5×) |
| E4 | 470k | 200k direto; 1 de 4 cartões saiu |
| E4-T03 | ≈5,08M em 330 turnos, 64% de releitura de cache | direto custaria 60 a 90k |
| Leva das telas (16→17/11) | ≈5,59M em 316 turnos | entregou 0 cartões de produto |

Na leva das telas, a Alice gastou 3,07M só na E6-F01, e a Bia fez 7 requisições.

### 1.4 Onde a leva das telas parou (memória `pilla-next-steps`, relatórios do Jorge)

| Hora | Parada | Causa | Categoria |
|---|---|---|---|
| 16/11 23h45–00h | hook barra commit de stub | regra (b) do guard_hook e STUB_LINE sem `"use client"`; corrigido por 7c9baee | harness |
| 00h–00h50 | E6-F01/F02 em `tests: escalated` | Bia usou `number` em vez de `bigint` com marca; checks contaminados por testes da F01 (harness-v12) | cartão + harness |
| 00h50 | E6-T02/T04 2×, T06 | toolCalls; teste rejeitado interfere no check (v13) | cartão grande |
| 01h04 | E7-T09/T10 com 25 e 21 de 20 chamadas | componente React não cabe em 20 chamadas (v14) | cartão grande |
| 01h07 | `recheck-tests` rebaixa done para error (v15) | estado só se corrige editando o estado.json | harness |
| 01h17 | rollback v13 descarta cartões done; T02 feito 2× | rollback por feature, não por cartão (v16, v17) | harness |
| ~02h | condição 4 (E6-T07 com 21 e 24 de 20) | cartão grande; refatiado só às 08h48 (49419c8) | cartão |
| 09h | Jorge sem crédito no Abacus | dependência de um único fornecedor pago | harness |

Foram **8 versões do Jorge (v8 a v15) entre 23h e 01h08**, intercaladas com a leva. Isso contraria a própria regra de "harness congelado na entrega" (memória `alice-delivery-not-harness`) e o AGENTS.md:52 ("quem acha não conserta no meio da entrega"). Na prática, cada falha virou versão nova do harness, e o harness novo virou falha nova.

### 1.5 Conclusão do diagnóstico

Tempo perdido, em ordem estimada:

1. **Harness mudando durante a entrega (≈40%).** Inclui as versões v2 a v5 "nao_aplicada" por bug do runner (2591935), o v7 com 503, o v8 barrado pelo commitlint e o v8 a v15 de madrugada.
2. **Cartões grandes para o 9B (≈30%).** São 9 de 9 falhas de 17/11. Commits de refatiamento: 9232a2e, df752ab, 2338087, 49419c8 e 914d53b.
3. **Espera por decisão do Joel (≈15%).**
   - Guardrail A em 16/11 às 17h40.
   - Estratégia de componentes, ainda pendente.
   - Teto da Bia temporário desde 85328f5.
   - Lista CA-11, comprovante, account_id e RF-02/04/23.
   - Parte disso foi resolvida em `docs/plano/decisoes-2026-11-17.md`.
4. **Retrabalho de teste da Bia (≈15%).**
   - Tipos errados na E6, com 4 requisições perdidas.
   - `loan-detail.test.tsx` ambíguo.
   - Testes não rastreados e sem revisão.

Os percentuais são estimativas pela linha do tempo acima. A seção 5 propõe como medir de verdade.

## 2. Brechas

| # | Brecha | Evidência | Efeito |
|---|---|---|---|
| 2.1 | **Etapas sem dono.** O AGENTS.md §3.1 não diz quem decide "cartão volta ao refinamento" nem quem revisa o teste da Bia antes da Alice. O Jorge "autônomo" está com o timer desligado e sem crédito. | AGENTS.md:40-52; memória `jorge-harness-owner` | falha fica parada esperando "alguém" |
| 2.2 | **Estados com saída só manual.** `tests: escalated`, `error` (recheck) e cota esgotada só saem editando o `estado.json`, e o erro 16 proíbe editar. O `feature reset` ainda está sendo feito (v17). | harness-v12, v15; e4-guardrails erro 16 | beco sem saída; o Claude ou para ou viola regra |
| 2.3 | **Rollback por feature.** Uma falha apagava cartões done; T02 foi feito 2×. A v17 cria checkpoint por cartão, mas ainda não foi testado em leva real. | harness-v16, v17 (JV17-1) | trabalho done perdido |
| 2.4 | **Orçamento da Bia.** O teto foi de 3 para 10 de madrugada (`cards.py:393`, "TEMPORÁRIO"). Não há livro-caixa por tentativa de rede. Requisição gasta em cartão mal escrito não volta. | cards.py:393; memória `bia-dense-calls` | free tier (50 por dia) acaba antes da leva acabar |
| 2.5 | **Cartão grande para o 9B.** O `alice.py cards` valida o formato, mas não o tamanho real. Componente React com tabela, ou função com 8 critérios de `done`, não cabe em 20 chamadas. | E6-T07 (E6.yaml:94-118, 9 linhas de done); E7-T09/T10 (E7.yaml:406, 484); metrics 17/11 | 9 de 9 falhas |
| 2.6 | **Decisão do Joel bloqueando a fila.** Item sem resposta segura a feature inteira, e não só o cartão. | pendências em `pilla-next-steps` | fila vazia de madrugada |
| 2.7 | **Jorge sem crédito.** Só um agente pago altera o harness; sem crédito, o harness não muda. Do lado oposto, com crédito ele muda demais (16 versões em 12 h). | v1 efe9b5f a v16 df8187c | ou nada muda, ou tudo muda |
| 2.8 | **Hooks e travas.** O `.claude/settings.json` está hoje com `"hooks": {}`, ou seja, travas desligadas na árvore suja. O hook barrou stub legítimo (7c9baee). Regra de trava só aparece quando bloqueia. | `git diff .claude/settings.json`; 7c9baee | ora sem proteção, ora bloqueio falso |
| 2.9 | **Métrica contaminada.** Os testes do harness (`E9-X`) gravam no `runs/metrics.jsonl` real: foram 41 de 52 linhas em 17/11. | metrics.jsonl | nenhum número de taxa é confiável |
| 2.10 | **Regras espalhadas.** São 20 memórias, AGENTS.md, docs/agents/* e 23 regras do cartão. Algumas memórias se contradizem: `alice-learn-per-run` manda "lição → harness" e `alice-delivery-not-harness` manda "harness congelado". `harness-subagent-model` está obsoleta. | MEMORY.md | cada sessão relê e reinterpreta; 64% do custo é releitura |
| 2.11 | **Árvore suja entre levas.** Testes da Bia não rastreados; @types/node sem commit; v17 não aplicada. | `git status` 17/11 | a leva seguinte começa sem base conhecida |

## 3. O formato proposto: trem diário

### 3.1 Etapas e horário

```
MANHÃ   (Joel, 10 min)  decide a caixa de decisões; aprova/recusa versão do harness da noite anterior
        (Claude)        congela: tag harness-AAAAMMDD; árvore limpa; quadro "pronto p/ leva"
DIA     LEVA            só cartões com DoR verde (plano-dor-dod.md); harness NÃO muda
                        falha → destrave (3.3), nunca conserto de harness
NOITE   RETRO (Claude)  quadro + caixa do Jorge/substituto; refatiar cartões que voltaram
        HARNESS (Jorge ou subagente) UMA versão, em worktree, suíte verde; aplicada só na manhã seguinte
```

Regra de ouro: **o harness muda no máximo uma vez por dia, fora da leva**. A exceção é um bug que corrompe dados, como um rollback apagando trabalho done. Nesse caso a leva para, entra o conserto e a leva recomeça do zero.

### 3.2 Papéis e WIP

| Papel | Faz | Não faz | WIP |
|---|---|---|---|
| **Joel** | decide a caixa de decisões (1×/dia), aprova o merge, aprova a versão do harness | — | — |
| **Claude orquestrador** | roda a leva, lê o quadro, aplica o destrave, registra | não edita código, harness, teste nem `estado.json`; não assume cartão da Alice | 1 leva |
| **Subagente de refinamento** | escreve e refatia cartões e testes.md com DoR | não roda a Alice | 1 feature à frente da leva (N+1) |
| **Subagente revisor** | DoR/DoD de documento, revisão dos testes da Bia | não escreve o que revisa | sob demanda |
| **Bia** | escreve e revisa os testes de uma feature | não implementa | 1 feature; ≤3 requisições |
| **Alice** | implementa 1 cartão | — | 1 cartão por vez |
| **Jorge (ou subagente substituto)** | 1 versão do harness por noite | não roda durante a leva | 1 versão |

O WIP da fila é de **no máximo 2 features em desenvolvimento e 1 em refinamento**. Feature nova só entra quando uma sai.

### 3.3 Destrave que não espera ninguém

| Situação | Ação automática | Quem | Prazo |
|---|---|---|---|
| Cartão falha 1× | retry, já incluso no `attempts` | harness | — |
| Cartão falha 2× (cota) | marca `voltou`; o cartão sai da leva; a fila segue com o próximo cartão **independente** | Claude | 2 min |
| Cartão `voltou` | o subagente de refinamento refatia (divide em 2 ou 3) sem pedir licença; passa por `alice.py cards`; volta à fila da **próxima** leva | subagente | mesmo dia |
| Cartão `voltou` 2× (refatiado e falhou de novo) | vira **"não compensa a Alice"** (3.4) | Claude registra; o Joel decide pela regra pré-aprovada | — |
| Teste da Bia reprovado | volta ao refinamento com o motivo; **não** sobe o teto | Claude | — |
| Estado preso (`escalated`, `error`) | `alice.py feature reset <ID> --to <etapa>`, comando registrado, nunca edição manual | Claude | 1 min |
| Problema de harness | `jorge.py anotar` e segue com outro cartão; se nenhum cartão anda, a leva fecha | Claude | — |
| Decisão do Joel pendente | o cartão fica `aguarda-joel`; a **feature segue nos outros cartões**; o item entra na caixa de decisões | Claude | — |

### 3.4 Regra "não compensa a Alice" [JOEL]

Um cartão é declarado **não compensa** quando acontece qualquer um dos itens abaixo:

- (a) falhou após um refatiamento (`voltou` 2×);
- (b) a estimativa de custo do Claude para preparar o cartão passa de 30% do custo de fazer direto. É a guardrail A, que já existe;
- (c) é componente React com mais de 1 elemento estrutural (tabela, formulário, lista) ou função com mais de 6 linhas de `done`, enquanto o perfil for o 9B.

O destino do cartão "não compensa" é **escolhido pelo Joel uma vez, agora, e vale até ele mudar**. Opções:

1. Modelo maior para esse cartão. Exemplos: qwen 14B/32B local, se couber na RTX 5070, ou um modelo pago barato.
2. Subagente do Claude faz, com rodapé `Card-Done-By: claude` e custo registrado. Isso exige revogar a regra "Claude nunca assume cartão" para essa classe de cartão.
3. Fica parado até o Joel decidir caso a caso, como é hoje. Isso **não é recomendado**, porque é exatamente o que trava a fila.

Recomendação: opção 1 se o modelo maior existir e passar num cartão de teste; senão, opção 2 com limite de N cartões por dia.

### 3.5 Caixa de decisões do Joel

- Arquivo único `docs/plano/decisoes-AAAA-MM-DD.md`, que já existe para 17/11. Cada pergunta tem uma recomendação e um **padrão que vale se não houver resposta até a leva seguinte**.
- O padrão é sempre o mais simples para o MVP, como na decisão de 00h15, em que o Claude decide esquema e colunas e registra.
- O Joel lê e responde **1×/dia, pelo celular**, com no máximo 10 itens.

## 4. Métricas (quadro, `alice.py quadro`)

| Métrica | Como medir | Meta da 1ª semana |
|---|---|---|
| Cartões done/dia | contagem de rodapés `Card-Done` por dia no git | ≥8 |
| Taxa de sucesso de 1ª passada | done ÷ execuções de produto em `metrics.jsonl`, **excluindo** tarefa `E9-*` | ≥60% |
| Horas paradas | soma dos intervalos sem execução de produto entre o início e o fim da leva (`metrics.jsonl` `at`) | ≤1 h por leva |
| % harness | commits em `tools/**` ÷ total do dia | <25% |
| Versões de harness/dia | tags `harness-*` | ≤1 |
| Custo do Claude por cartão done | `alice.py cost` (transcript) ÷ Card-Done | ≤150k |
| Requisições da Bia por feature | livro-caixa | ≤3 |

## 5. Top 5 mudanças

| # | Mudança | Custo | Risco | Como medir |
|---|---|---|---|---|
| 1 | **Congelar o harness por dia**: tag de manhã, nenhuma versão durante a leva, Jorge ou substituto só à noite em worktree. | baixo: regra no AGENTS.md §3.1 e checagem `git diff tag..HEAD -- tools/` no início da leva | bug real fica 1 dia sem conserto (mitigação: exceção de corrupção de dados) | versões/dia ≤1; % harness <25% |
| 2 | **Teto de tamanho por cartão no DoR** (plano 2): máximo de linhas de `done`, de arquivos e de elementos de UI, com `alice.py cards` acusando. Refatiar antes, não depois de falhar. | médio: 1 regra nova no `cards.py`, pelo Jorge/substituto | falso positivo barra cartão bom (mitigação: só aviso na 1ª semana) | taxa de 1ª passada ≥60% |
| 3 | **Destrave sem espera** (3.3) com `feature reset` oficial e estado `voltou`. | médio: `feature reset` já está na v17; `voltou` é um campo no quadro | uso de reset para esconder falha (mitigação: reset registrado no quadro, com motivo) | horas paradas ≤1 h; 0 edições de `estado.json` |
| 4 | **Regra "não compensa"** pré-decidida pelo Joel (3.4). | baixo para decidir; o custo depende da opção | opção 2 aumenta o custo do Claude (mitigação: limite por dia e custo no relatório) | cartões `voltou` 2× resolvidos no mesmo dia |
| 5 | **Métrica limpa e uma fonte de regras**: testes do harness gravam em diretório temporário; memórias obsoletas são apagadas; regras de processo ficam só em AGENTS.md e docs/agents. | baixo: 1 ajuste no harness e limpeza de memória | perder nuance de memória antiga (mitigação: o que vale é migrado para docs/agents antes de apagar) | `E9-X` some do metrics; nº de memórias ≤10 |

## 6. Decisões do Joel

1. **[JOEL]** Aprovar o trem diário: harness congelado durante a leva e no máximo 1 versão por dia.
2. **[JOEL]** Destino dos cartões "não compensa" (3.4): modelo maior, subagente do Claude com limite, ou caso a caso.
3. **[JOEL]** Teto da Bia: voltar a 3 (`cards.py:393` está em 10 "TEMPORÁRIO").
4. **[JOEL]** Padrão por omissão na caixa de decisões: o Claude decide pelo mais simples se não houver resposta até a leva seguinte.
5. **[JOEL]** Dono do harness sem crédito no Abacus: recarregar o Jorge ou oficializar o subagente do Claude como substituto, com as mesmas regras de worktree e suíte verde.
6. **[JOEL]** Religar os hooks de `.claude/settings.json`. Estão vazios na árvore atual. Confirmar se foi intencional.
