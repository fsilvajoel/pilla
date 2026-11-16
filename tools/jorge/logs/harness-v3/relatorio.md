# harness-v3 — integridade de checks e orçamento

## Identificação

- **Versão:** harness-v3
- **Data:** 2026-11-16T15:45:24-03:00 (recebida; término não fornecido)
- **Execução:** Review harness-v3; ID específico indisponível.
- **Estado da versão:** proposta
- **Escopo recebido:** pendências v1/v2, decisão autônoma baseada em evidências, evolução do próprio prompt; prioridade checks/medição e I–L; 40 passos análise, 60 aplicação, leitura até 400 linhas, teto 3000 créditos.
- **Fontes recebidas:** `tools/jorge/logs/harness-v{1,2}/relatorio.md`, `tools/alice-harness/runs/retro-20261116-{102951,102615}.md`, código/testes e pedido. Sem retro nova indicada.
- **Base git:** `32b8c6282a0dc6786d5360970bd19cbdad25342b` (informada; não aferida por git).
- **Workspace inicial:** isolado, limpeza não aferível pelas ferramentas.
- **Modelo/provedor efetivamente utilizados:** metadados da API indisponíveis; `gpt-6-sol` informado, não prova do provedor.
- **Autorizações de Joel:** ordem explícita deste Review para aplicar o que for permitido, inclusive travas I–L com teste; não autoriza violar invariantes nem cria serviço externo/credencial.
- **Suíte de referência:** VERDE, 231 testes, `python3 -m unittest discover -s tests` em `tools/alice-harness`, informada pelo runner; falhas/erros/ignorados não discriminados.

## Diagnóstico

### Fatos confirmados
- V2 testou as três correções até VERDE 238 (`harness-v2/relatorio.md:201-214`), mas **nada foi aplicado**: runner detectou caminho inválido `ools/alice-harness/alice.py` (sem `t` inicial), não falha da suíte. V1 não escreveu: recusa de escrita anterior de teste de portão (`harness-v1/relatorio.md:153-163`). Não repetir o erro de caminho: toda escrita deve começar literalmente por `tools/`.
- `alice.py:192-200` passa exit 0 de cobertura vazia; `bia.py:128-129` distribui para feature e checks dos cartões. `feature.py:321,331` roda testes contra implementação no worktree, mas `:265-269` usa HEAD para descrever stub; `:382-395` usa checkout que altera índice, portanto não reutilizar esse isolamento sem prova.
- `bia.py:88-113` pode tentar rede três vezes e só soma `USAGE` quando recebe `choices`; `feature.py:204-233` conta uma chamada do orquestrador antes do chat, ignorando retries e perdendo diferença de tokens na exceção. `cards.py:393,443-445` permite orçamento até seis; `feature.py:183-224` confia no plano/estado editáveis. `alice.py:1239-1243` e `bia.py:344-357,448-456,485-501` também chamam a Bia fora da feature.
- `feature.py:195-199` deixa diagnósticos antigos; retro `102951:26-33` reporta `tests: done` e `tests: quota: ... (4/4)` simultaneamente, com cota OpenRouter 15; retro `102615:22-27` também mostra cota da feature e 3/6. `alice.py:1373-1389,1456` só aceita diretório no resume. `bia.py:77-85` só usa OpenRouter para Bia; `.env.example:1-11` não contém Abacus. Timer/gatilho de Review já existem (v2:25,139-152).
- `metricas(metrics)`: 28 runs, 17 done, ~201,2 s e ~1,96 tentativas por run; `metricas(evolution)` não mede economia de correções v2, pois foram revertidas.

### Causas e hipóteses
- **Confirmada:** ausência de bloqueio de cobertura zero; checks TDD não isolados; `finish` acumula erro; contador de sucesso não mede tentativas de rede; estado/plano não são autoridade independente. Reversão v2 foi causada por caminho de escrita sem primeira letra, embora testes estivessem verdes.
- **Não confirmada:** formato completo do vitest real além do incidente `Unknown% (0/0)`; respostas brutas OpenRouter para erro de cota/tokens, quantidade de chamadas poupáveis pelo stub; regra de migração dos planos do produto 4–6 e autenticação de liberação fora do worktree. Não representar zero desconhecido como custo medido.

### Justificativa econômica
- Falso verde e gasto acima do teto são riscos de integridade prioritários. Reaplicar três correções já testadas em v2 pode custar menos que a análise original (~1837,88 créditos totais v2), sem prometer êxito. Regresso transacional do stub exige testes git. Uma trava local de três requisições sem autoridade externa dá falsa segurança se rotulada I–L completos; aplicar somente bloqueios verificáveis e documentar limites. Outras propostas sem frequência/repro não justificam gastar API antes de features. Nenhum ganho realizado é mensurável.

## Evoluções

| ID | Problema | Evidência — arquivo:linha na base ou retro | Mudança | Arquivos | Teste que prova | Risco | Tipo | Status |
|---|---|---|---|---|---|---|---|---|
| JV3-1 | cobertura 0/0 verde (JV1-1/JV2-1) | `alice.py:192-200`; v2:201-214 | não zero para total global `Unknown% (0/0)` em comando de cobertura | `tools/alice-harness/alice.py`, `tools/alice-harness/tests/test_test_guardrails.py` | exit 0 + zero falha; cobertura positiva/command comum preservados | médio: formato de saída | correção | adiada — aguardando aplicação |
| JV3-2 | testes da etapa veem implementação prévia (JV1-2/JV2-2) | `feature.py:305-339,382-395` | snapshots e stub HEAD só durante os dois lotes de checks; restaurar conteúdo/modo/índice; falhar fechado | `tools/alice-harness/feature.py`, `tools/alice-harness/tests/test_feature_orchestrator.py` | teste git com staged diferente, impl anterior, path sem HEAD e falha/exceção | médio/alto: manipulação temporária de arquivos | correção | adiada — aguardando aplicação, condicionada à prova |
| JV3-3 | tokens/requisições invisíveis quando chat falha ou tenta novamente | `bia.py:88-113,156-158`; `feature.py:220-233` | contador por tentativa de rede e usage quando fornecida; delta em `finally` da etapa, sem inventar custo ausente | `tools/alice-harness/bia.py`, `tools/alice-harness/feature.py`, `tools/alice-harness/tests/test_test_guardrails.py`, `tools/alice-harness/tests/test_feature_orchestrator.py` | duas tentativas contam duas mesmo em falha; usage presente em resposta sem choices conta; erro sem usage não inventa tokens | médio: semântica de métricas | métrica | adiada — aguardando aplicação |
| JV3-4 | orçamento I–L forjável (JV1-3/JV2-3) | `cards.py:393,443-445`; `feature.py:183-224`; `bia.py:88-113`; v2:79-92 | **somente** teto 3 no validador e parada antes de rede por tentativas quando comprovável; liberação/ledger autenticado dependem de autoridade fora da escrita: não alegar I–L completos | `tools/alice-harness/cards.py`, `tools/alice-harness/bia.py`, `tools/alice-harness/feature.py`, testes, `tools/alice-harness/roles/planner.md`, `docs/agents/{orquestracao,cartao-de-tarefa}.md` se teto aplicado | 4 rejeitado, 3 aceito; retry esgota teto, plano/estado alterados não devem destravar (se não provar, não aplicar segurança fictícia) | alto: teto de produção/migração | trava | adiada — aguardando aplicação, condicionada à prova; parte externa adiada — invariante |
| JV3-5 | estado preserva erro antigo (JV2-4) | `feature.py:195-199`; retro `102951:26-33` | limpar somente `message/red` ao terminar etapa, preservar segundos/contadores | `tools/alice-harness/feature.py`, `tools/alice-harness/tests/test_feature_orchestrator.py` | erro→done sem diagnóstico velho; novo erro preservado | baixo | correção | adiada — aguardando aplicação |
| JV3-6 | prompt de Jorge presume espera por Joel contra ordem autônoma | `tools/jorge/agente/jorge.md:34,38-40,59-69` | instruir decisão autônoma baseada em evidências; `perguntar_joel` só registro sem espera, invariantes/risco continuam limites | `tools/jorge/agente/jorge.md` | revisão textual de consistência e suíte após evolução; não há teste automatizado de prompt | baixo/médio: futuras decisões | agente | adiada — aguardando aplicação |
| JV3-7 | resume por ID, cota bruta, Abacus, commits intermediários e gatilho adicional (JV1-4/JV2-5/6/7) | `alice.py:1352-1354,1373-1389`; `bia.py:62-85`; v2:109-152 | sem alteração de CLI/fluxo sem repro/semântica; não fingir chave Abacus usada por Bia nem inserir commits/gatilho duplicado | nenhum | futura repro ID ambíguo/ausente; payload real de quota/usage antes de corrigir | médio: falsa compatibilidade/corrida | simplificação | adiada — evidência insuficiente (ID, quota, Abacus); recusada (commits e gatilho) |

### JV3-1 — cobertura não vazia
- **Causa e comportamento atual:** `run_cmd` devolve código puro mesmo para `All files | Unknown% (0/0)`.
- **Comportamento pretendido:** saída global comprovadamente 0/0 em check `--coverage` não pode virar verde em Alice, Bia nem feature.
- **Implementação mínima:** reconhecer indicador global estreito e retornar erro legível. **Fora do escopo:** mexer no vitest/produto, inferir total quando não exibido.
- **Dependências e ordem:** primeira; nenhuma funcional. **Prova de regressão:** teste dublando subprocess falha antes, passa depois.
- **Casos negativos/limites:** check não cobertura, tabela com total positivo, código já não zero e saída vazia não devem criar falso verde.
- **Compatibilidade:** CLI/config iguais; consumidores `run_cmd`/`run_checks` recebem erro adicional; inspeção O(saída), custo mínimo. **Auditoria:** não aplicável (portão não é trava). **Autorização:** escopo do Review. **Custo/benefício esperado:** integridade alta, economia não estimável. **Resultado observado:** pendente. **Motivo do status:** aguardando aplicação.

### JV3-2 — checks contra stub
- **Causa e comportamento atual:** `stage_tests` verifica worktree; `with_stub` do complemento usa checkout que altera índice.
- **Comportamento pretendido:** ambos os lotes veem HEAD stub; restauração exata do índice, conteúdo/existência e modo, também após falha.
- **Implementação mínima:** contexto específico da etapa; preparar snapshots, aplicar HEAD só no worktree e restaurar em finally; se preparação falhar, status error e nenhum done. **Fora do escopo:** reformar complemento/produto.
- **Dependências e ordem:** depois JV3-1; parar se segurança transacional não comprovada. **Prova:** fixture git em teste de orquestração deve falhar antes da correção; erro de git não chama checks.
- **Casos negativos:** impl staged diferente, novo em HEAD ausente, arquivo removido, exceção. **Compatibilidade:** CLI/config iguais; consumidores da etapa TDD obtêm check do stub; git I/O pequeno, economia de reparos hipotética. **Auditoria:** não aplicável. **Autorização:** ordem do Review; v1 bloqueou teste porque núcleo antigo classificava indevidamente portão como trava. **Resultado:** pendente. **Motivo:** aguardando aplicação condicionada à restauração.

### JV3-3 — contagem honesta
- **Causa e comportamento atual:** `USAGE` só sobe em sucesso com choices; `ask` só grava deltas depois de sucesso.
- **Comportamento pretendido:** distinguir tentativa de rede de resposta válida, contabilizar usage existente mesmo sem choices, sem marcar tokens ausentes como medidos.
- **Implementação mínima:** somar requisição imediatamente antes de `urlopen` de completions (não quota); somar tokens disponíveis de resposta, inclusive resposta de erro que informe usage; capturar delta no caminho de exceção do `ask` sem duplicação. **Fora do escopo:** inferir preço/tokens de HTTP sem usage, chamada de quota como completions.
- **Dependências e ordem:** antes JV3-4 para usar contagem por tentativa. **Prova:** mock de duas tentativas, erro parcial com usage e falha de HTTP; evitar espera real. **Limites:** `quota()` desconhecida permanece `?`, uso ausente não é token medido; se report exigir distinguir desconhecido de 0, adiar representação até prova de formato. **Compatibilidade:** CLI/config inalteradas; `USAGE`, relatórios de feature e plan-run passam a contar tentativas em vez de só sucesso (quebra semântica declarada); overhead constante; economia não comprovada. **Auditoria:** alterações de linhas de orçamento/cota devem ir ao commit de trava, se tocadas; métricas puras não são trava. **Autorização:** Review. **Resultado:** pendente. **Motivo:** aguardando aplicação.

### JV3-4 — teto e autoridade I–L
- **Causa e comportamento atual:** `biaBudget` até 6, orçamento baseado em arquivos manipuláveis, retries de rede não debitados, rota `plan-run` fora do orçamento da feature.
- **Comportamento pretendido:** I livro-caixa durável autoritativo e atômico fora do controle do agente; J teto 3; K parar antes de cada tentativa; L liberação extraordinária exclusivamente autenticada por Joel.
- **Implementação mínima:** reduzir validação para 2..3 e harmonizar testes/docs **somente se** não quebrar feature ativa sem migração; ligar pré-checagem à fronteira de tentativas de rede se houver autoridade confiável; nunca armazenar liberação forjável no mesmo worktree. **Fora do escopo:** editar `docs/plano/**`, núcleo, `.env`, elevar cota, simular assinatura de Joel.
- **Dependências e ordem:** após JV3-3; por risco alto, não aplicar fragmento que se anuncie I–L completo ou deixe bypass. **Prova:** orçamento 4 inválido e 3 válido, adulteração de plano/estado não libera chamada, retry conta e para, erro de persistência nega rede, liberação falsa rejeitada; caso negativo plano legado 4–6. **Compatibilidade:** quebra de configuração para planos 4–6; CLI de liberação não existe; consumidores feature/plan-run/direct Bia precisam mesma autoridade; custo de serviço externo desconhecido. **Auditoria:** trava — auditoria do Joel se tocar linhas de orçamento/cota, commit separado pelo runner. **Autorização:** ordem do Review autoriza travas testadas, mas não concede acesso a autoridade externa. **Custo/benefício:** integridade potencial alta, falsa segurança pior que adiar parte externa. **Resultado:** pendente. **Motivo:** aplicação apenas de bloco comprovável; autenticação externa adiada por invariante, não aguardando resposta.

### JV3-5 — limpar diagnóstico efêmero
- **Causa/pretendido:** `finish` atualiza dict sem apagar `red/message` anteriores; resultado done deve refletir rodada atual.
- **Implementação mínima:** retirar estas duas chaves antes de update. **Fora do escopo:** editar estados existentes. **Dependências:** após JV3-2 por uso compartilhado de `feature.py`. **Prova:** error→done remove diagnóstico, erro novo mantém, segundos acumulam; 0/0 protegido por JV3-1. **Compatibilidade:** CLI/config iguais; leitores de estado/retro não verão erro obsoleto; custo negligenciável. **Auditoria:** não aplicável. **Autorização:** ordem do Review. **Resultado:** pendente. **Motivo:** aguardando aplicação.

### JV3-6 — agente autônomo responsável
- **Causa/pretendido:** prompt manda aguardar Joel apesar de ordem atual para decisão autônoma; deve agir sem esperar, registrar pergunta só informativa quando realmente necessária, respeitando soberania do núcleo.
- **Implementação mínima:** alterar trechos do próprio prompt, manter barreira de invariantes, regra de teste e prudência econômica. **Fora do escopo:** alterar núcleo/modelo/permissões. **Dependências:** após correções prioritárias. **Prova:** inspeção textual; suíte após edição só prova ausência de regressão do harness, não comportamento futuro do agente. **Limites:** caminho proibido continua proibido, mudança de produto não se autoconcede. **Compatibilidade:** CLI/config/consumidores de software sem impacto; comportamento dos Reviews futuros muda, custo indeterminado. **Auditoria:** não aplicável. **Autorização:** pedido explícito. **Resultado:** pendente. **Motivo:** aguardando aplicação.

### JV3-7 — fila residual julgada
- **Causa/decisão:** `resume` por ID precisa busca segura com regra para duplicados; cota/tokens brutos sem payload não permitem corrigir aritmética; Abacus não é chave de Bia (`bia.py:77-85`). `plan-run` não commita deliberadamente e timer já detecta features.
- **Implementação mínima:** nenhuma. **Fora do escopo:** commits, API/credenciais reais, mudança de produto. **Dependências:** nova evidência futura; não bloquear demais itens. **Prova futura:** ID único/duplicado/inexistente e caminho antigo, payload real com usage/quota em erro; gatilho somente com latência observada. **Casos negativos:** nunca escolher execução ambígua; não duplicar Review nem atribuir uso OpenRouter a Abacus. **Compatibilidade:** nenhuma CLI/config/consumidor mudado; custo evitado de automação especulativa, não quantificado. **Auditoria:** não aplicável. **Autorização:** autonomia para recusar o que não é provado. **Resultado:** nenhuma escrita prevista. **Motivo:** partes adiadas por evidência insuficiente; commits/gatilho recusados por contrariar fluxo vigente.

## O que ficou para Joel decidir

| Decisão | Evolução | Motivo | Opções e recomendação | Bloqueia aplicação? |
|---|---|---|---|---|
| Autoridade independente para ledger/liberação e migração de planos legados, sem conceder escrita a Jorge | JV3-4 | núcleo/serviço e `docs/plano/**` proibidos; arquivo do worktree falsificável | serviço autenticado com reserva atômica ou mecanismo do núcleo exclusivo de Joel; recomendar não declarar I–L completos até prover autoridade, migrar planos fora deste Review | apenas parte externa; restantes seguem |

Isto registra limite mecânico, não pedido para aguardar Joel durante este Review. Se qualquer escrita for recusada, não tentar outro caminho.

## Execução e suíte

| Momento | Evolução | Resultado | Executados | Falhas | Erros | Ignorados | Evidência |
|---|---|---|---:|---:|---:|---:|---|
| Referência | — | VERDE informado | 231 | não informadas | não informados | não informados | pedido do runner |
| Regressão antes da correção | — | pendente aplicação | — | — | — | — | — |
| Após evolução | JV3-1/2/3/4/5/6 | pendente, `run_tests()` após cada uma | — | — | — | — | — |
| Final — runner | — | pendente | — | — | — | — | — |

- **Comando:** `python3 -m unittest discover -s tests`, em `tools/alice-harness`.
- **Anomalias de descoberta/contagem:** nenhuma aferida; zero testes nunca é verde; final ≥231.
- **Tentativas e falhas intermediárias:** nenhuma nesta análise; v2 registrou 1 suíte vermelha intermediária antes de concluir 238 verdes (`relatorio.md:213-214`).
- **Desvios do relatório inicial:** nenhum ainda.
- **Resultado transacional:** pendente do runner, não alegar commit.
- **Commit:** preenchimento exclusivo do runner.
- **Se não aplicado:** registrar bloqueio e diff preservado pelo runner.
- **Evoluções revertidas:** nenhuma nesta análise.

## Custo da execução do Jorge

| Medida | Valor | Fonte/observação |
|---|---:|---|
| Requisições à API, incluindo retries | indisponível | runner |
| Tokens de entrada | indisponível | API/runner |
| Tokens de saída | indisponível | API/runner |
| Tokens totais | indisponível | runner, sem dupla contagem |
| Entrada em cache | indisponível | API |
| Raciocínio | indisponível | runner, indicar inclusão |
| Custo monetário | indisponível | preços/usage não fornecidos |
| Chamadas de ferramentas / suítes | indisponível / 0 nesta análise | runner |
| Duração total | indisponível | runner |

- **Cobertura da medição:** parcial nesta fase; runner agrega análise/aplicação/erros.
- **Estimativas separadas dos valores medidos:** benefício qualitativo; `metricas` mede 28 runs e não mede impacto das correções v2 revertidas.
- **Consumo de Bia:** nenhum pelo Review.
- **Conclusão:** checks e contadores têm prioridade de integridade; custo de implementação e benefício monetário ainda não medidos; não alegar economia realizada.


---
## Verificação do runner
- Status: **nao_aplicada**
- Base: `32b8c6282a0dc6786d5360970bd19cbdad25342b`
- Suíte final: VERDE, 239 testes (referência 231)
- Arquivos alterados: ocs/agents/cartao-de-tarefa.md, docs/agents/orquestracao.md, tools/alice-harness/alice.py, tools/alice-harness/bia.py, tools/alice-harness/cards.py, tools/alice-harness/feature.py, tools/alice-harness/roles/planner.md, tools/alice-harness/tests/test_feature_orchestrator.py, tools/alice-harness/tests/test_features.py, tools/alice-harness/tests/test_test_guardrails.py, tools/jorge/agente/jorge.md
- Travas (commit separado `Trava: sim`, auditoria do Joel): nenhuma
- Problemas: escrita proibida: ocs/agents/cartao-de-tarefa.md (permitido: tools/alice-harness/**, docs/agents/**, .agents/policy.yaml, tools/jorge/agente/**; nunca segredos, núcleo, estado, apps, packages)

## Resumo do finish
Implementados para validação final (não afirmo aplicação/commit): JV3-1 cobertura global `Unknown% (0/0)` falha, JV3-2 checks de tests sob stub HEAD com snapshot de worktree/índice, JV3-3 contagem de tentativas de rede e tokens fornecidos em erro, JV3-5 limpeza de diagnósticos obsoletos, JV3-6 prompt autônomo. JV3-4 PARCIAL: trava de orçamento em `cards.py` reduz `biaBudget` de 2..6 para 2..3 (teste 3 válido/4 inválido; docs e fixtures alinhadas); NÃO há ledger independente, parada por tentativa no limite de feature nem liberação autenticada: estado/plano continuam manipuláveis e retries podem exceder orçamento da feature. Não declarar I–L implementados. Migração de planos existentes 4–6 exige alteração de `docs/plano/**`, proibida; features legadas poderão ser bloqueadas até migração externa. JV3-7 adiada por falta de evidências para resume por ID, cota bruta e Abacus; recusados commits intermediários e gatilho duplicado. Arquivos alterados: `tools/alice-harness/{alice.py,bia.py,cards.py,feature.py,roles/planner.md,tests/test_test_guardrails.py,tests/test_feature_orchestrator.py,tests/test_features.py}`, `docs/agents/{cartao-de-tarefa.md,orquestracao.md}`, `tools/jorge/agente/jorge.md`. Trava aplicada para auditoria de Joel: redução da linha BIA_BUDGET em cards.py; contagem em bia.py também altera linhas relacionadas a cota/contadores, classificar como trava se runner considerar aplicável. Testes: referência VERDE 231 informada; regressões vermelhas esperadas 233 (JV3-1), 235 (JV3-2), 238 (JV3-3), 238 (JV3-4), 239 (JV3-5); verde após JV3-1 233, após JV3-2 235 (houve ajuste do teste de exceção: API retorna status error), após JV3-3 238, após JV3-4 238, após JV3-5 e JV3-6 239. Nenhum teste automatizado demonstra segurança contra manipulação de plano/estado na parte I–L; portanto não reivindicar essa segurança. Desvios: JV3-4 apenas teto documental/validação, não implementação integral; JV3-2 não altera `with_stub` do complemento e não testa ausência de HEAD em fixture adicional; risco restante registrado. Sem chamadas reais da Bia nem consumo comprovado de créditos deste Review; custo de API cabe ao runner. Perguntas ao Joel: nenhuma registrada; limitação externa de autoridade e migração está no relatório.

## Custo da execução do Jorge (runner)

| Medida | Valor |
|---|---:|
| Modelo(s) | gpt-6-sol |
| Requisições | 57 (falhas re-tentadas: 0, sem usage: 0) |
| Tokens de entrada | 650129 |
| Entrada em cache | 4414443 |
| Tokens de saída | 12632 |
| Raciocínio (já na saída) | 0 |
| Créditos Abacus | 2852.93 |
| Passos análise / aplicação | 8 / 49 |
| Suítes rodadas | 13 |
| Início / fim | 2026-11-16T15:45:24-03:00 / 2026-11-16T15:49:11-03:00 |
