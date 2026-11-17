# harness-v13 — restaurar antes dos checks e barrar dependências externas

## Identificação

- **Versão:** harness-v13
- **Data:** 2026-11-17T00:50:22-03:00 (informada; relógio não aferido)
- **Execução:** Review harness-v13; ID adicional não fornecido.
- **Estado da versão:** proposta.
- **Escopo recebido:** falhas E6-T02/T04 (duas tentativas cada) e T06 por limite de chamadas; aviso de run_check/finish; testes antigos rejeitados interferindo nos checks compartilhados; implementação parcial contaminando próxima feature; dependência externa E6-T02 não done antes de executar F02. Análise ≤40 passos, aplicação ≤60, read_file ≤400 linhas, teto 3000 créditos.
- **Fontes recebidas:** pedido e anotações 00:19:31 e 00:41:27; `tools/jorge/logs/harness-v12/relatorio.md`; retros `tools/alice-harness/runs/retro-20261117-{002344,002350,004715,004956}.md` e logs `runs/E6-T{02,04,06}/.../log.jsonl`. Nenhuma retro indicada nominalmente no pedido.
- **Base git:** `3957ac2051cd7577f0037a738a899f50dc058284` (`docs/mvp-planning`), worktree `jorge/harness-v13` informado.
- **Workspace inicial:** isolado informado; limpeza não verificável com ferramentas de leitura.
- **Modelo/provedor efetivamente utilizados:** `gpt-6-sol` informado; metadados efetivos da API não disponíveis.
- **Autorizações de Joel:** nenhuma nova; nenhuma mudança de trava ou orçamento proposta.
- **Suíte de referência:** VERDE, 265 testes, `python3 -m unittest discover -s tests` no harness, informada pelo runner; falhas/erros 0 inferidos, ignorados não informados.

## Diagnóstico

### Fatos confirmados

- `metricas(evolution)` registra 5/5 execuções E6 com status não done, média 27 chamadas e 466.281 tokens de entrada; `metricas(metrics)` cobre 34 runs, 18 done, 20.371.887 tokens de entrada acumulados (não são custo deste Review). Retros 002344:5-22, 004715:5-22 e 004956:5-13 registram limites 24, 18 e 20, até 29 chamadas e 304.750–861.749 tokens por rodada. Logs T02 002039:51-54 mostram checks ainda sendo rodados após atingir o teto; T04 004302:26-40 tem typecheck vermelho por `simulation.ts` fora de allowedPaths e tentativas bloqueadas; T06 004752:2-4,15-21 vê T02/T04 ainda stub.
- `feature.py:363-378` executa checks compartilhados antes de retirar entregas antigas, embora `restore_allowed` em `alice.py:1111-1131` já preserve cópia e restaure HEAD. `feature.py:451-465` não restaura allowedPaths quando `plan_run` falha; o `restore_allowed` na entrada do *próximo* cartão (`alice.py:1153-1155`) não impede checks compartilhados de outra feature de verem um arquivo incompleto. Retro 002350:5-17 confirma F02 escalated por erro de `simulation.ts`.
- `feature.py:722-729` valida somente o plano da feature, não o estado das dependências de cartões fora dela. `alice.py:1362-1375` só consulta `failed` gerados nesta mesma chamada, portanto a dependência E6-T04 de E6-T05 (`docs/plano/E6.yaml:150`) não barra F02, mesmo com F01 failed; T02→T03→T04 estão na F01 (`E6.yaml:47,82,117,219-225`).
- `alice.py:927-1037` envia aviso como mensagem de usuário **somente depois de processar todo o lote de ferramentas** e `budget.status()`; no `nudge` incrementa `attempts`, e `stop` falha sem verificar se `run_check` já rodou. `gates.py:108-134` permite mais 4 chamadas após o aviso e encerra na quinta. Logs T04 004302:32-39 mostram `finish` com checks vermelhos seguido de repetidos bloqueios de escopo; T02 004144:26-53 mostra checks vermelhos e correções ainda necessárias. Teto de chamadas não é limite de tamanho derivado de `cards.size_model` (`cards.py:217-233` regula linhas/contexto; `alice.py:727-729` lê `budget.toolCalls` do cartão). Validação `cards.py:246-248,363-368` já exige 8+3/check; E6-T04 com 3 checks e 18 chamadas está acima do mínimo 17. Aumentar limites sem resolver erros de dependência/escopo não comprova benefício.

### Causas e hipóteses

- **Confirmada:** ordem do preflight; ausência de rollback no fim da etapa implement falha; dependências interfeature não consultam estado externo; mensagem de limite não garante encerramento útil quando checks estão vermelhos.
- **Não confirmada:** que o limite de chamadas seja *intrinsecamente* insuficiente para tela/lib: erros de tipo no código parcial e dependências stub explicam parte das chamadas; dados não isolam complexidade da tarefa. Não há medição de quantas chamadas uma solução correta exigiria. Não afrouxar teto ou checks nesta versão.

### Justificativa econômica

- 5 falhas observadas, dois preflights indevidos e uma dependência stub com 300–860k tokens de entrada por cartão: portões locais antes dos agentes e restauração preservando cópia podem evitar retrabalho; benefício futuro estimado, não economia medida. Cada preflight depende de check local, mas a mudança de ordem não cria check adicional. Rollback de erro protege testes de pacote sem desligar cobertura/typecheck. Evitar orçamento maior impede repetição cara sem prova de eficácia.

## Evoluções

| ID | Problema | Evidência — arquivo:linha na base ou retro | Mudança | Arquivos | Teste que prova | Risco | Tipo | Status |
|---|---|---|---|---|---|---|---|---|
| JV13-1 | Entrega antiga contamina preflight de `tests` | `feature.py:363-378`; anotação 00:19:31 | Restaurar testes antigos antes de checks compartilhados, sem chamar Bia em erro; preservar cópia | `tools/alice-harness/feature.py`, `tools/alice-harness/tests/test_feature_orchestrator.py` | fake de restore remove teste antigo; check só passa depois; caso check ainda vermelho não chama Bia | baixo: sequência de operações em tests | correção | adiada — aguardando aplicação |
| JV13-2 | Falha de implement deixa diff parcial contaminar outra feature | `feature.py:451-465`; retro 002350:5-17 | Após `plan_run` não done, restaurar allowedPaths dos impls ao HEAD, guardando cópias em runs/previous, sem restaurar testes da Bia | `tools/alice-harness/feature.py`, `tools/alice-harness/tests/test_feature_orchestrator.py` | fake escreve implementação parcial e retorna failed; diff removido, cópia intacta; done preserva implementação | médio: risco de remover alterações anteriores; documentar restauração apenas em falha e cópia verificável | correção | adiada — aguardando aplicação |
| JV13-3 | F02 roda sem F01 done apesar da dependência E6-T04 | `E6.yaml:150,219-225`; `feature.py:722-729`; `alice.py:1362-1375`; log T06 004752:2-4 | Preflight de `feature` para dependências de cartões fora da feature: ler `docs/plano/<feature>/estado.json` do produtor; exigir identificação da feature e status `implement: done` **com cartão dependido `done`**, ou `review: done` se necessário; ausência/estado inválido falha fechado; não consumir Bia/Alice | `tools/alice-harness/feature.py`, `tools/alice-harness/tests/test_feature_orchestrator.py`, `docs/agents/orquestracao.md` | fixture F01 failed/skipped/missing impede F02 antes da Bia; F01 com impl done do cartão exigido permite; deps internos não bloqueiam etapa tests | médio: estados históricos podem não registrar todos os cartões; falha fechada e erro identificável | correção | adiada — aguardando aplicação |
| JV13-4 | Aviso de limite chega tarde e cobra finish impossível com checks vermelhos | `alice.py:927-1037`; `gates.py:108-134`; log T04 004302:32-40 | Não afrouxar calls; avaliar proposta posterior de falha acionável com diagnóstico de check e parada sem ciclos de chamadas bloqueadas, após medir benefício e teste de integração | nenhum agora | teste futuro: aviso após lote, checks vermelhos, status/diagnóstico fiel; verde e cobertura 0/0 preservados | médio: alterar contador pode mascarar laço | correção | recusada — sem mecanismo pequeno comprovado para aumentar adesão ao aviso |
| JV13-5 | Suposta necessidade de aumentar budget/toolCalls por size_model | `cards.py:217-248,363-368`; E6 retros citadas | Não elevar orçamentos nem novos tetos; corrigir causas mensuráveis antes de reavaliar | nenhum | comparação futura de runs limpos vs. falhas | alto: custo/loops maiores sem prova | correção | recusada — causa atribuída ao tamanho não demonstrada |

### JV13-1 — restaurar antes do preflight
- **Causa e comportamento atual:** `stage_tests()` faz preflight antes de `ops.restore`; tests rejeitados presentes podem reprovar check do pacote sem consumir Bia, mesmo que a entrega antiga fosse retirada depois.
- **Comportamento pretendido:** remoção/restauração dos testes antigos precede os checks; se check permanecer vermelho, status não done, zero Bia e saída de diagnóstico.
- **Implementação mínima:** mover bloco `log_dir.mkdir`/`ops.restore`/salvamento de revisão para antes de `shared_test_checks`; sem mudança de comandos ou escopo de `restore_allowed`.
- **Fora do escopo:** editar testes de produto ou esconder checks amplos.
- **Dependências e ordem:** nenhuma; antes de JV13-2.
- **Prova de regressão:** FakeOps com arquivo antigo e shared check dependente da presença: antes `escalated`, depois `done`; negativo shared check genuinamente vermelho não pede Bia, preserva cópia da entrega antiga. Verificar exceção de restore como erro, não sucesso.
- **Casos negativos/limites:** restaurar somente allowedPaths test-author e revisão existente; falha de leitura/check nunca aprova; 0/0 não fica verde.
- **Compatibilidade:** CLI/config iguais; consumidores Bia e Claude recebem teste limpo antes do check; custo esperado nenhum check adicional, eventual economia em chamadas/escaladas (não medida).
- **Auditoria:** não aplicável. **Autorização:** pedido recebido. **Resultado observado:** pendente. **Motivo do status:** aguardando aplicação.

### JV13-2 — rollback da implementação falha
- **Causa e comportamento atual:** `stage_implement` apenas registra resultado; alterações parciais ficam na árvore e contaminam typecheck/lint de features seguintes.
- **Comportamento pretendido:** status não done não deixa diff nos allowedPaths dos cartões implement; preservar versão para Claude investigar em runs/previous. Sucesso mantém diff e testes da Bia inalterados.
- **Implementação mínima:** usar `ops.restore(c,self.log_dir)` para impls em resultado falho, com `log_dir` criado; não mudar `plan_run`, testes nem contadores. Se restauração falhar, status error e diagnóstico; nunca declarar done silenciosamente.
- **Fora do escopo:** restauração dos arquivos de produto pelo Jorge nesta análise; reversão de commits preexistentes ou de testes fora de allowedPaths.
- **Dependências e ordem:** após JV13-1 (independente funcionalmente).
- **Prova de regressão:** dublê de execução falha que grava diff e restauração verdadeira via `FeatureOps.restore`; verificar HEAD recuperado, cópia do diff, status failed e testes intocados; caso done mantém código; falha de restore não reporta done.
- **Casos negativos/limites:** caminhos compartilhados entre impls (vitest.config.ts) não devem sobrescrever cópias da primeira restauração; cópias podem conter trabalho prévio não commitado, portanto restauração e preservação devem ser explícitas ao Claude. 0/0 não aprovado.
- **Compatibilidade:** CLI/config iguais; consumidores Claude verão árvore sem implementação parcial, logs em runs/previous; custo: operações git locais/cópia por falha, podem poupar outro run de Bia/Alice, sem números realizados.
- **Auditoria:** não aplicável. **Autorização:** anotação 00:41:27. **Resultado observado:** pendente. **Motivo do status:** aguardando aplicação.

### JV13-3 — preflight das dependências de outra feature
- **Causa e comportamento atual:** validação de existência do ID no plano não verifica se foi concluído; `plan_run` só sabe de falhas na chamada atual. T06 conhece T05, mas T05 depende T04 fora da feature.
- **Comportamento pretendido:** antes de tests/recheck-tests/implement/audit/review/all, bloquear feature com dependência interfeature não concluída; estado do produtor pertence à mesma entrega/plano e cartão correto; não aprovar por `tests:done` apenas.
- **Implementação mínima:** mapear `dependsOn` dos membros da feature ao mapa global de cartões e features do mesmo plano; se dep fora do conjunto, carregar estado do produtor, exigir `feature` correto e `stages.implement.cards[dep] == done` + `stages.implement.status == done`; em revisão concluída mas sem mapa, definir regra inequívoca de comprovação (não inferir automaticamente); erro objetivo sem consumir agentes. Dependências dentro da feature seguem fluxo atual. Evitar bloquear a etapa `plan`, que só valida cartão.
- **Fora do escopo:** editar E6.yaml/estado.json reais ou alterar dependências; resolução de IDs de outros planos não demonstrada (falhar fechado com mensagem identificável para decisão posterior).
- **Dependências e ordem:** após JV13-1/2, funcionalmente independente.
- **Prova de regressão:** dois produtores no mesmo plano e estado fixture: missing/invalid/failed/skipped/card missing bloqueiam F02 antes de shared checks/Bia; done completo libera; dependência interna não é falsamente externa. Caso negativo feature sem associação única não passa; cobertura 0/0 nunca significa done.
- **Compatibilidade:** sem novo flag/config; consumidor Claude vê erro prévio e instrução de concluir produtor; Bia/Alice não gastam chamada em bloqueio. Estados antigos sem mapa entram em erro explícito; migração manual por orquestração válida, não editar estado à mão. Custo: leituras locais de JSON, economia potencial em runs indevidos; não medida.
- **Auditoria:** não aplicável. **Autorização:** pedido recebido. **Resultado observado:** pendente. **Motivo do status:** aguardando aplicação.

### JV13-4 — avaliar nudge com diagnóstico posterior
- **Causa e comportamento atual:** aviso é visível no turno seguinte, mas não pode tornar checks vermelhos verdes; logs mostram finish recebido e reprovado, seguido de tentativas bloqueadas.
- **Comportamento pretendido/implementação mínima:** nenhuma alteração neste Review; se recorrência após isolamento de dependência, testar parada com motivo específico preservando checks completos, sem dar verde por falta de finish. Não alterar teto/grace nem incentivar ignorar typecheck.
- **Fora do escopo:** mudança de modelo/quantidade de chamadas sem evidência. **Dependências:** medir após JV13-1 a 3.
- **Prova/casos negativos:** teste de lote de chamadas e erro de check, inclusive 0/0; ainda não projetado. **Compatibilidade:** CLI/config/consumidores inalterados; custo zero agora. **Auditoria:** não aplicável. **Autorização:** não requerida para recusar. **Resultado observado:** nenhuma mudança. **Motivo do status:** recusada — eficácia do texto isolado não demonstrada.

### JV13-5 — não aumentar toolCalls
- **Causa e comportamento atual:** size_model não define `budget.toolCalls`, que é explícito e validado separadamente. Problemas prévios de dependência e escopo explicam consumo substancial.
- **Comportamento pretendido/implementação mínima:** nenhum aumento de cota/limite; medir execução com dependências done e checks basais verdes primeiro.
- **Fora do escopo:** editar planos ou fazer teste real de produto. **Dependências:** reavaliar só após JV13-1 a 3.
- **Prova/casos negativos:** novos dados/experimento controlado ausentes; preservar limite de loops. **Compatibilidade:** nenhuma alteração CLI/config/consumidores; custo zero agora, evita possível consumo extra. **Auditoria:** não aplicável. **Autorização:** nenhuma para afrouxamento. **Resultado observado:** nenhuma mudança. **Motivo do status:** recusada — falta de prova de benefício.

## O que ficou para Joel decidir

| Decisão | Evolução | Motivo | Opções e recomendação | Bloqueia aplicação? |
|---|---|---|---|---|
| Nenhuma obrigatória | — | ajustes propostos são portões comuns e rollback no escopo de escrita | manter checks e budgets; se quiser liberação de dependência sem estado confiável, exigir prova separada | Não |

Qualquer reparo efetivo de `apps/**`, `docs/plano/**`, aprovação/commit de cartão ou ajuste de orçamento de Bia está fora da lista de escrita; este relatório não o autoriza.

## Execução e suíte

| Momento | Evolução | Resultado | Executados | Falhas | Erros | Ignorados | Evidência |
|---|---|---|---:|---:|---:|---:|---|
| Referência | — | VERDE informado | 265 | 0 (inferido) | 0 (inferido) | não informado | pedido runner |
| Regressão antes da correção | JV13-1/2/3 | não realizada: análise só leitura | — | — | — | — | análise |
| Após evolução | — | pendente | — | — | — | — | aplicação |
| Final — runner | — | pendente | — | — | — | — | runner |

- **Comando:** `python3 -m unittest discover -s tests`, no diretório do harness.
- **Anomalias de descoberta/contagem:** nenhuma informada; 0 testes não é verde.
- **Tentativas e falhas intermediárias:** nenhuma suíte rodada na análise.
- **Desvios do relatório inicial:** nenhum até aqui.
- **Resultado transacional:** pendente do runner. **Commit:** pendente do runner.
- **Se não aplicado:** registrar impedimento e diff preservado pelo runner. **Evoluções revertidas:** nenhuma nesta fase.

## Custo da execução do Jorge

Dados da API e runner indisponíveis nesta análise; não deduzir custo do nome do modelo ou de métricas de Alice.

| Medida | Valor | Fonte/observação |
|---|---:|---|
| Requisições à API, incluindo retries | indisponível | runner |
| Tokens de entrada | indisponível | usage |
| Tokens de saída | indisponível | usage |
| Tokens totais | indisponível | runner; sem dupla contagem |
| Entrada em cache | indisponível | usage |
| Raciocínio | indisponível | runner informará inclusão na saída |
| Custo monetário | indisponível | runner/preços |
| Chamadas de ferramentas / suítes | indisponível / 0 nesta análise | runner |
| Duração total | indisponível | runner |

- **Cobertura da medição:** parcial, pendente do runner.
- **Estimativas separadas dos valores medidos:** apenas economia potencial qualitativa; números E6 são medições de execução da Alice, não deste Review.
- **Consumo de Bia:** nenhum pelo Review.
- **Conclusão:** bloquear runs com dependência quebrada e manter árvores limpas antes dos checks pode evitar gasto futuro; não declarar economia realizada sem pós-medição.


---
## Verificação do runner
- Status: **aplicada**
- Base: `3957ac2051cd7577f0037a738a899f50dc058284`
- Suíte final: VERDE, 270 testes (referência 265)
- Arquivos alterados: docs/agents/orquestracao.md, tools/alice-harness/feature.py, tools/alice-harness/tests/test_feature_orchestrator.py
- Rodadas de reparo usadas: 0
- Revertidos só estes (invariante): nenhum
- Travas (commit separado `Trava: sim`, auditoria do Joel): nenhuma
- Problemas: nenhum

## Resumo do finish
Candidatas implementadas, pendentes da validação final e commit do runner: JV13-1 (restauração dos testes antigos antes dos checks compartilhados), JV13-2 (em implement não done, preserva cópias em runs/previous e restaura allowedPaths ao HEAD; erro de restauração não é sucesso) e JV13-3 (bloqueia etapas com dependência interfeature sem estado implement: done e cartão done). JV13-4 recusada: aviso isolado não corrige checks vermelhos; JV13-5 recusada: insuficiência intrínseca de toolCalls não comprovada, nenhum teto elevado. Arquivos alterados: tools/alice-harness/feature.py, tools/alice-harness/tests/test_feature_orchestrator.py, docs/agents/orquestracao.md. Travas: nenhuma. Suíte de referência: 265 verdes informados. Regressões antes das correções falharam como esperado; após JV13-1: 267 verdes; após JV13-2: 269 verdes; após JV13-3 e documentação: 270 verdes (python3 -m unittest discover -s tests pelo run_tests). Houve ajustes nos dublês dos testes e rodadas intermediárias vermelhas; nenhum teste de produto ou chamada real à Bia. Desvios: nenhum orçamento alterado; mudanças de produto e estado real não executadas. Perguntas ao Joel: nenhuma. Resultado transacional, integração e suíte final são responsabilidade do runner.

## Custo da execução do Jorge (runner)

| Medida | Valor |
|---|---:|
| Modelo(s) | gpt-6-sol |
| Requisições | 40 (falhas re-tentadas: 0, sem usage: 0) |
| Tokens de entrada | 859609 |
| Entrada em cache | 3968900 |
| Tokens de saída | 11699 |
| Raciocínio (já na saída) | 0 |
| Créditos Abacus | 3672.23 |
| Passos análise / aplicação | 8 / 32 |
| Suítes rodadas | 10 |
| Início / fim | 2026-11-17T00:50:22-03:00 / 2026-11-17T00:53:13-03:00 |
