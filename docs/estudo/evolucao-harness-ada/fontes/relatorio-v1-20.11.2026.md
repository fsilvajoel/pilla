# Avaliação do processo pilla + Harness-adaV1 (20/11/2026)

## 1. Resumo executivo
Hoje o harness **não foi efetivo como fábrica**. Funcionou como **trava** (gates e hooks pegaram erro real), mas não como **linha de produção**. A única feature do dia (E9-F02) parou depois do refinamento. Daí em diante tudo foi feito à mão por subagentes Sonnet, e o estado foi marcado à mão. O processo declarado (testes revisados → expect-red → implement) é bom. O que falta é ele andar sozinho: hoje cada etapa que falha cai no orquestrador, que é o recurso mais caro.

## 2. O que funcionou
- **Gates de qualidade pegaram erro de verdade.** Pegaram `.env.example` desatualizado (1b3dc7c, 33d7053), dependência não aprovada (8a75725, depois registrada em `docs/travas.md`) e asserções fracas: o commit b8d0e66 diz que trocou `toBeDefined` por asserções concretas.
- **O expect-red fez o que devia.** Em 20/11 03:11 ele reprovou testes que não rodavam (erro de import) e 1 teste que passava sem implementação. Era exatamente o defeito que a revisão Opus achou depois.
- **O refinamento com fila de PM funciona.** O E9-F02 chegou a `ajustado` na rodada 2, e as perguntas foram para `pendencias-pm.md` e respondidas pelo Joel no mesmo dia.
- **Rastreabilidade honesta.** O `estado.json` registra tentativas, tokens (Pepe: 324k de prompt para um plano reprovado), escalada e a nota "fora do harness". A dívida está escrita, não escondida.
- **Commits pequenos e com referência ao cartão.** Isso dá auditoria fácil.

## 3. O que não funcionou
1. **O fluxo parou no meio.** No E9-F02, `tests`, `testReview` e `review` estão `pending`, não há `testShas` e o `expect-red` está FAIL, mas `implement=done` (d940b89). O gate `tests-reviewed` nunca rodou. *Risco:* o "pronto" da feature não tem a garantia que o harness promete.
2. **Os workers baratos não entregaram.** O Pepe gastou ~490k tokens (plano + segunda opinião) e o plano foi reescrito pelo Claude. A Bia nem foi usada. *Custo:* tokens grátis, mas tempo do orquestrador para reescrever.
3. **A revisão dos testes não pegou teste fraco.** A Opus achou testes que passariam com a feature quebrada, depois do test-writer e da Vera. *Risco:* alto, porque essa é a promessa central do workflow.
4. **Relatórios de subagente sem prova.** "Lint passou" e "320 testes" vieram antes de typecheck/lint rodarem. *Custo:* reconferência manual, de 47k a 113k tokens por agente, ~8 agentes.
5. **O índice do git ficou sujo.** O stash `b44653d WIP on exp/e9-front` e o `6be565f index on` aparecem no log de hoje, e há 6 stashes antigos (E4-T04, de 16/11). Agora mesmo há 4 testes do E9-F02 modificados e não commitados. *Risco:* commit misturado e hook reprovando código certo.
6. **Planos F03–F05 saíram com defeito.** Paths errados em cartões, gate em cartão que não usa, decisões de 20/11 fora do `E9.md` e schemas só na branch c1f5148. O 027178e corrigiu parte disso, mas deixou decisões "pendentes em revisao.md". *Custo:* retrabalho de mais um ciclo de planejamento.
7. **Gate de consistência contornado por commit separado.** O feat (b8d0e66) e o "mark implement done" (d940b89) foram commits separados. O gate exige o estado, então o estado foi forjado para satisfazê-lo.
8. **Higiene de branch.** O código de feature (b8d0e66) entrou na branch `docs/mvp-planning`. Seis worktrees `pilla-wt-*` continuam ativas.

## 4. Causa-raiz
1. **Não há caminho de degradação dentro do harness.** Quando um worker falha, a única saída é "fazer por fora". Falta um papel substituto previsto (ex.: `fallback: sonnet` por etapa) que mantenha os gates e o `estado.json`. Por isso o fluxo quebra em vez de trocar de executor.
2. **O critério de aceite do subagente é texto, não artefato.** O subagente "diz" que passou. Nada obriga a devolver a saída do `pnpm verify` nem o resultado do gate. O orquestrador vira auditor.
3. **O revisor de testes não executa nada.** A Vera lê o teste; ninguém roda o teste contra uma implementação quebrada. O expect-red só prova "falha sem código", não "falha com código errado". O gate de mutação existe, mas fica na etapa 5, tarde demais.
4. **O hook age sobre o índice, e a sessão herda estado.** Sem um passo de "área limpa" no início de cada etapa (índice vazio, sem stash pendente, na branch certa), o lixo de uma sessão vaza para a seguinte.
5. **O planejamento não tem gate de formato.** Plano e cartão só são validados quando alguém tenta executar. Path inexistente e schema em outra branch deveriam falhar no commit do plano.

## 5. Recomendações
| Prioridade | Mudança | Por que | Custo | Quem decide |
|---|---|---|---|---|
| 1 | `fallback` por etapa no `harness.project.yaml` (ex.: test-writer: bia → sonnet), executado pelo próprio workflow, com os mesmos gates | Elimina o "fora do harness"; falhar vira trocar de executor | médio | Joel |
| 2 | Subagente só é aceito se anexar o stdout do `pnpm verify` e do gate da etapa (o orquestrador compara o hash e o exit code, não lê o texto) | Acaba com a reconferência manual | baixo | orquestrador |
| 3 | Mutação rápida (Stryker só nos `sources` da feature) **antes** da revisão dos testes, ou como entrada para a Vera | Pega o teste que passa com a feature quebrada | médio | Joel |
| 4 | Pré-etapa "área limpa": índice vazio, `git stash list` sem itens da feature, branch `feat/<id>`, falhando se houver sujeira | Mata o problema do índice e da branch errada | baixo | orquestrador |
| 5 | Gate `plan-lint`: paths dos cartões existem (ou estão em `sources` novos), gates citados batem com o tipo de cartão, imports de schema resolvem na branch atual | Pega os defeitos de F03–F05 no ato | médio | orquestrador |
| 6 | Proibir `implement=done` sem `testShas`; fechar a dívida do E9-F02 rodando `tests-reviewed`/review sobre o que existe | Dá ao gate de status um sentido real | baixo | Joel |
| 7 | Rebaixar o Pepe no plano (só segunda opinião) até ele acertar 1 plano | 490k tokens para um plano reprovado | baixo | Joel |
| 8 | Limpeza semanal: worktrees `pilla-wt-*` mescladas e stashes com mais de 3 dias | Menos estado herdado | baixo | orquestrador |

## 6. O que NÃO mudar
- **A ordem testes → expect-red → implement.** Ela pegou o defeito certo; o problema foi pular, não a regra.
- **Hooks e gates bloqueando push.** Doeu hoje, mas cada bloqueio foi erro real (o falso positivo do Q1 foi corrigido na causa, em 8a75725).
- **`estado.json` com tentativas, tokens e nota de dívida.** É a base para medir a fábrica; mantenha.

## 7. Perguntas para o Joel
1. Você aceita o Sonnet como fallback **oficial** do test-writer e do implementer (pago, mas dentro dos gates), ou prefere insistir em workers grátis e aceitar mais trabalho manual?
2. O E9-F02 volta para o fluxo (tests-reviewed + review) antes de seguir para F03, ou a dívida fica registrada e seguimos?
3. Mutação antes da revisão dos testes: o tempo extra de CI por feature é aceitável?

*Observação:* o item 5 do briefing diz que a etapa tests "ficou pendente", mas o expect-red rodou às 00:11 de 20/11 sobre esboços com testes. Ou seja, houve tentativa de tests que não foi gravada em `stages.tests`. Isso confirma a causa 1.
