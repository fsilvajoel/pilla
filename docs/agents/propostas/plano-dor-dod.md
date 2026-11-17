# Plano 2: guardrails de escrita, DoR e DoD

> Proposta, 17/11/2026. Ainda não está em vigor. Só vale depois que o Joel aprovar. Os itens marcados **[JOEL]** são decisões dele.

## Resumo (celular)

1. A maioria das falhas nasce no texto: cartão grande, teste ambíguo, tipo errado no pedido à Bia. Em 17/11, das 11 execuções de produto, 9 falharam no teto de chamadas, ou seja, por cartão grande demais (`runs/metrics.jsonl`).
2. **DoR** é o que precisa estar pronto para algo *entrar* numa etapa. **DoD** é o que precisa estar verdade para algo *sair* dela.
3. Há 5 níveis: documento, feature, cartão da Alice, bloco de testes da Bia e leva. Cada nível tem um checklist curto.
4. Cada item diz quem confere:
   - **[M]** é máquina: `alice.py cards`, lint de docs ou checks;
   - **[R]** é subagente revisor;
   - **[J]** é o Joel.
5. O que é [M] barra sozinho, em segundos. O que é [R] leva no máximo 10 min por feature. O Joel só entra em documento de produto.
6. Os anti-padrões reais (E6-T07, E7-T09/T10, `loan-detail.test.tsx`, E6-F01/F02) viram regras com checagem.
7. Há 4 decisões do Joel no fim do documento.

---

## 1. Anti-padrões reais

| Caso | O que aconteceu | Evidência | Regra que evita |
|---|---|---|---|
| **E6-T07** `simulate` | 9 linhas de `done`, 2 regras (RN-C03, RN-C04), 5 conversões de tipo, proibição de `if`/`??`/`?.`/`try` e preservação de stub, tudo num cartão. Estourou 2× (21 e 24 de 20 chamadas) e bloqueou em cascata T09, T04, E6-F02 e E7-F02. Foi dividido em df752ab e de novo em 49419c8. | `docs/plano/E6.yaml:94-118`; harness-v16 | C1, C2, C6 |
| **E7-T09/T10** render de lista e detalhe | Cada cartão pedia o componente inteiro: link, tabela de 6 colunas, `dl` de 5 pares, labels, imports. Estouraram com 25 e 21 de 20 chamadas. O 9B não monta JSX estrutural grande em 20 chamadas. | `docs/plano/E7.yaml:406-428, 484-506`; harness-v14 | C1, C3 |
| **`loan-detail.test.tsx`** "0,00" | `within(openRow).getByText("0,00")` numa parcela aberta que tem *pago = 0,00* e *encargos = 0,00*. São duas células com o mesmo texto, e `getByText` lança "multiple elements". O teste falha por ambiguidade e não por erro da Alice. Ninguém revisou: o arquivo estava não rastreado. | `apps/web/components/loan-detail.test.tsx:28-29`; `apps/web/lib/mock-data.ts:79` (`open(3, "2027-02-14")`) | T3, T5 |
| **E6-F01/F02** requisições da Bia | O pedido não trazia os tipos reais (`Cents = bigint` com marca). A Bia escreveu `number`. Foram 4 requisições sem nenhum teste aproveitável; os checks também ficaram contaminados por testes da F01. Para não travar, o teto subiu de 3 para 10. | memória `bia-dense-calls`; harness-v12; `tools/alice-harness/cards.py:393` | T1, T2, F4 |
| **Limite duplicado** | 150 linhas num lugar e 341 em outro. O E4-T03 levou 10 bloqueios, 574 s e 2,9M tokens. | e4-guardrails erro 15 | D3 (uma definição por texto) |
| **Cobertura 0/0** | Vitest `Unknown% (0/0)` passou verde. | e4-guardrails erro 17; harness-v1 | K3 |

## 2. Guardrails de escrita por tipo de texto

Regras comuns a todo documento:

- **D1. Uma definição por texto.** Número, limite ou regra aparece em um lugar só; o resto *cita* esse lugar.
- **D2. Rastreabilidade.** Todo requisito, regra ou cenário tem ID (RF-xx, RN-xx, CA-xx, T-xx). Quem usa cita o ID e não copia o texto.
- **D3. Sem número mágico solto.** Limite, teto ou orçamento aponta para a fonte: `policy.yaml`, `models.yaml` ou `cards.py`.
- **D4. Exemplo concreto.** Regra de cálculo sempre traz pelo menos 1 exemplo numérico de ouro.
- **D5. Estado explícito.** O cabeçalho diz `rascunho`, `proposto`, `aprovado` ou `obsoleto`, e quem aprovou e quando.

| Tipo | Guardrails específicos |
|---|---|
| **PRD** | Cada RF tem critério de aceite (CA) testável: entrada, ação e resultado esperado com valor. Fora de escopo explícito. Nada de "deve ser rápido" ou "amigável" sem número. |
| **RFC** | Contratos (esquema, rota, tabela) com tipo exato, incluindo bigint com marca, nunca "número". Seção "Alternativas rejeitadas". Seção "Perguntas abertas", cada uma com dono e prazo. |
| **ADR** | Contexto, decisão e consequências em até 1 página. Uma decisão por ADR. Se substitui outra, aponta `Substitui ADR-xxxx`. |
| **Plano** (`docs/plano/README.md`, `plano.md` de feature) | Ordem e dependências entre features, decisões pendentes listadas com o padrão por omissão. Sem regra de processo (essa fica no AGENTS.md e em docs/agents). |
| **YAML de épico/feature** | `biaBudget` ≤ teto da política, sem valor "temporário" comentado. `dependsOn` só aponta para cartões que existem. Toda feature lista seus `testes.md`. |
| **Cartão** | As 23 regras de `docs/agents/cartao-de-tarefa.md` continuam valendo, mais as regras de tamanho C1 a C6 abaixo. |
| **testes.md** | Cenário com ID da regra, dados de entrada vindos do mock real e resultado esperado **único na tela ou no retorno**. Tipos do domínio citados pelo nome (`Cents`, `IsoDate`). |

### Regras novas de tamanho do cartão (C1 a C6)

| # | Regra | Por quê | Checagem |
|---|---|---|---|
| C1 | `done` com no máximo **6 linhas**, contando os imports literais | E6-T07 tinha 9; E7-T10 tinha 7 | [M] `alice.py cards` (aviso na 1ª semana, erro depois) |
| C2 | No máximo **1 regra de negócio** (RN) por cartão `implement` | E6-T07 tinha RN-C03 e RN-C04 | [M] |
| C3 | Componente React: no máximo **1 elemento estrutural** por cartão (tabela **ou** `dl` **ou** formulário) | E7-T09/T10 | [M] heurística por palavra-chave no `done` (`table`, `dl`, `form`); [R] confirma |
| C4 | Toda proibição ("no if, no ??") vira check de lint ou de grep, não linha de `done` | o 9B gasta chamadas tentando provar o negativo | [R] |
| C5 | Estimativa `toolCalls` = 8 + 3 por check + 2 por linha de `done`. Se passar do teto, refatiar, **nunca subir o teto** | memória `feature-roles-sizing` | [M] (estende a LI-055, `cards.py:366-368`) |
| C6 | Cartão refatiado 2× vira "não compensa" (plano-fluxo §3.4) | E6-T07 refatiado 2× | [M] contador no quadro |

### Regras novas de teste da Bia (T1 a T5)

| # | Regra | Checagem |
|---|---|---|
| T1 | O pedido à Bia inclui os **tipos reais** (trecho de `packages/finance` e do esquema) e o mock usado | [M] o `bia.py` recusa pedido sem o bloco de tipos |
| T2 | O teste roda contra o stub e **falha pelo motivo certo** (`not implemented`), sem erro de tipo nem de import | [M] typecheck e execução contra o stub (já existe desde a v2) |
| T3 | Toda consulta de texto na tela é **única**: `getByText` de valor que pode repetir usa `getByRole("cell", …)` ou coluna nomeada | [R] revisor (nenhum lint pega isso) |
| T4 | Um `it` por regra (CA/T/RN no nome); nada de 0/0 de cobertura | [M] já existe (erro 17) |
| T5 | Valor esperado sai do mock, conferido célula a célula; repetir valor no mesmo escopo exige comentário do porquê | [R] |

## 3. DoR e DoD por nível

### 3.1 Documento (PRD, RFC, ADR, plano)

**DoR (pode ser escrito)**
- [ ] [J] O pedido do Joel está registrado: o que e por quê.
- [ ] [R] Existe a lista de documentos afetados.

**DoD (aprovado)**
- [ ] [M] Lint de docs: links internos válidos, IDs únicos, cabeçalho de estado (D5). *Novo, pequeno script.*
- [ ] [M] Lint de docs: nenhum limite numérico duplicado entre docs/agents, AGENTS.md e `policy.yaml` (D1, D3).
- [ ] [R] Cada RF tem CA com valor; cada contrato tem tipo exato.
- [ ] [R] Perguntas abertas têm dono e padrão por omissão.
- [ ] [J] Joel aprovou: estado `aprovado` com a data.

### 3.2 Feature

**DoR (entra no refinamento)**
- [ ] [J] PRD/RFC/ADR citados estão `aprovado`.
- [ ] [R] Decisões pendentes com padrão por omissão (plano-fluxo §3.5).
- [ ] [M] Os tipos e o mock que os testes vão usar já existem no repositório.

**DoR (entra no desenvolvimento)**, que é o portão mais importante:
- [ ] [M] `alice.py cards` verde, com C1 a C6.
- [ ] [M] Testes da Bia commitados, rodando contra o stub e falhando pelo motivo certo (T2).
- [ ] [R] Testes revisados (T3, T5), em até 10 min.
- [ ] [M] Requisições da Bia ≤ teto; árvore limpa; harness na tag do dia.

**DoD**
- [ ] [M] Todos os cartões com `Card-Done`; checks do pacote verdes; cobertura real (≠0/0).
- [ ] [M] Nenhum `// @stub` sobrando dos cartões da feature.
- [ ] [R] Revisão final do Claude: o código cumpre os CA citados.
- [ ] [M] Custo registrado (`alice.py cost`) no quadro.
- [ ] [J] PR aprovado pelo Joel.

### 3.3 Cartão da Alice

**DoR**
- [ ] [M] `alice.py cards` verde: formato, 23 regras, C1 a C6, `dependsOn` done.
- [ ] [M] Stub marcado (`// @stub <ID>`) commitado; `protectedTests` existe e falha contra o stub.
- [ ] [M] Estimativa de chamadas ≤ teto (C5).

**DoD**
- [ ] [M] Todos os `checks` com exit 0 no `finish`; cobertura >0.
- [ ] [M] Diff só dentro de `allowedPaths`; testes protegidos intactos.
- [ ] [M] Marca de stub removida; commit com `Card-Done: <ID>`.
- [ ] [R] Auditoria do harness sem achado bloqueante.

### 3.4 Bloco de testes da Bia (por feature)

**DoR**
- [ ] [M] O `testes.md` tem cenários com ID, entrada e resultado único (T3).
- [ ] [M] O pedido carrega o bloco de tipos e o mock (T1).
- [ ] [M] Há requisições na cota do dia: o livro-caixa tem ≥ `biaBudget` mais a reserva de 5.

**DoD**
- [ ] [M] Typecheck e lint verdes; roda contra o stub e falha só por `not implemented` (T2).
- [ ] [M] Um `it` por ID de regra (T4).
- [ ] [R] Revisão T3/T5; achado vira correção pelo **subagente de refinamento** (não nova requisição da Bia) se for ajuste de até 5 linhas.
- [ ] [M] Arquivos commitados. Teste não rastreado não conta como pronto.

### 3.5 Leva

**DoR (começar)**
- [ ] [M] Harness na tag do dia; `git status` limpo; hooks ativos (`.claude/settings.json` com hooks não vazios).
- [ ] [M] Fila com ≥3 cartões com DoR verde, de pelo menos 2 features (N+1).
- [ ] [M] Cota da Bia e Ollama respondendo.
- [ ] [J] A caixa de decisões do dia foi lida ou passou do prazo (vale o padrão).

**DoD (fechar)**
- [ ] [M] Todo cartão está `done`, `voltou` ou `aguarda-joel`; nenhum estado `error` ou `escalated` pendurado.
- [ ] [M] Árvore limpa; nada de produto não rastreado.
- [ ] [M] Relatório de tokens (Claude × Alice × Bia) e métricas do plano-fluxo §4 no quadro.
- [ ] [R] Caixa do Jorge com os problemas de harness da leva; cartões `voltou` passados ao refinamento.

## 4. Integração sem burocracia

| Portão | Onde barra | Quem verifica | Tempo |
|---|---|---|---|
| Documento aprovado | antes do refinamento | lint de docs [M], depois subagente [R], depois Joel [J] | M: segundos; R: 10 min; J: no ciclo diário |
| Cartão pronto | `alice.py cards`, que já roda antes da leva | máquina | segundos |
| Testes prontos | `alice.py feature` etapa `tests` → `implement`, que já existe | máquina + subagente revisor | ≤10 min por feature |
| Leva pronta | primeiro passo do `/loop leva` | máquina (script de pré-voo) | 1 min |
| Leva fechada | último passo do `/loop leva` | máquina + Claude | 5 min |

Princípios:

1. **Só se acrescenta checagem de máquina onde já há portão.** Nenhuma etapa nova é criada. As regras C1 a C6 entram no `cards.py` e as T1/T2 no `bia.py`, na próxima versão noturna do harness (plano-fluxo §3.1), escrita pelo Jorge ou substituto.
2. **[R] tem prazo.** Se o revisor não responder em 10 min, a feature segue e o item fica marcado `revisão pendente` no quadro. A revisão não bloqueia a fila.
3. **Na 1ª semana, C1 a C3 são aviso e não erro**, para calibrar os números (6 linhas, 1 RN, 1 elemento) com dados reais. Os limites são **[JOEL]**.
4. **Uma fonte**: este checklist vai para `docs/agents/dor-dod.md` depois de aprovado, e as memórias que repetem essas regras são apagadas.

## 5. Decisões do Joel

1. **[JOEL]** Adotar DoR/DoD nos 5 níveis, com a lista de portões da seção 4.
2. **[JOEL]** Limites de tamanho do cartão: `done` ≤6 linhas, 1 RN, 1 elemento estrutural de UI. Aviso na 1ª semana e erro depois?
3. **[JOEL]** O revisor pode corrigir teste da Bia de até 5 linhas sem gastar requisição (T3/T5)? Isso muda a regra "Bia escreve testes".
4. **[JOEL]** Criar o lint de docs (links, IDs, estado, limite duplicado) como tarefa do harness na próxima versão noturna.
