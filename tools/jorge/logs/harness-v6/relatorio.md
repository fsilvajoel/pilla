# harness-v6 — reaplicação comprovável do v5 e documentação do sprint

## Identificação
- **Versão:** harness-v6
- **Data:** 2026-11-16T17:40:10-03:00 (recebida; horário efetivo não aferido)
- **Execução:** Review harness-v6; ID adicional não fornecido.
- **Estado da versão:** proposta.
- **Escopo recebido:** reaplicar diff v5 fornecido, completar JV5-6 e triagem dos itens v2–v5 não concluídos; sem trabalho de produto; análise ≤40 passos, aplicação ≤60, leitura ≤400 linhas/chamada, teto 3000 créditos.
- **Fontes recebidas:** pedido e diff v5; `tools/jorge/logs/harness-v{2,3,4,5}/relatorio.md`; `tools/alice-harness/runs/retro-20261116-102951.md`; `AGENTS.md:38-52`; código e testes referidos abaixo.
- **Base git:** `5546b77dd72143fff445be082bf79eef303ab415`, `docs/mvp-planning`, worktree isolado `jorge/harness-v6` (informado).
- **Workspace inicial:** isolamento informado; limpeza não verificável com ferramentas de leitura disponíveis.
- **Modelo/provedor efetivamente utilizados:** `gpt-6-sol` informado; provedor efetivo não comprovado pelos metadados acessíveis.
- **Autorizações de Joel:** pedido atual de reaplicação e conclusão das correções; pedido v5 de aplicação autônoma, sujeito aos invariantes; nenhuma autorização para caminhos proibidos nem elevação de cotas.
- **Suíte de referência:** VERDE, 231 testes, `python3 -m unittest discover -s tests` em `tools/alice-harness`, fornecida pelo runner; falhas/erros/ignorados não detalhados.

## Diagnóstico
### Fatos confirmados
- V5 terminou **não aplicada** apesar de 238 testes verdes: `tools/jorge/logs/harness-v5/relatorio.md:102-114` relata caminho truncado `ools/alice-harness/alice.py`; o pedido informa correção do runner em 2591935, que não é motivo para mexer no núcleo. O diff fornecido é parcial: termina durante teste em `test_test_guardrails.py`, sem JV5-6.
- `alice.py:192-200` repassa código zero mesmo com total global `Unknown% (0/0)`; `bia.py:128-129` reutiliza `run_cmd`. `feature.py:305-339` executa checks da Bia contra worktree em vez de HEAD; o `with_stub:382-395` altera índice e não pode ser reaproveitado sem reparo próprio.
- `bia.py:88-113` soma apenas respostas com `choices`; `feature.py:213-234` conta chats e perde delta de tokens em exceção. `cards.py:393,443-445` aceita orçamento 6; `feature.py:204-224` confia em estado/plano locais. `feature.py:195-199` mantém diagnósticos obsoletos; a retro `retro-20261116-102951.md:26-33` exibe `tests: done` e mensagem velha `tests: quota`.
- `AGENTS.md:38-52` explicita sprint de seis etapas, testes prontos e revisados antes da Alice e Jorge fora da entrega. `docs/agents/orquestracao.md:26-38,80`, `cartao-de-tarefa.md:98-115` e `travas.md:109-110` ainda descrevem contrato anterior; `roles/planner.md:13` menciona 2–6. O CLI `feature.py:538-553` permite `all` ir diretamente de tests para implement e **não** implementa aprovação externa entre elas.
- `metricas(metrics)`: 28 runs, 17 done (60,7%), média 1,96 tentativas e 201,2 s; `metricas(evolution)` não permite atribuir economia a v2–v5 revertidas. Busca de consumidores encontrou `feature.py`, `bia.py`, `alice.py`/`plan_run`, `retro.py`, fixtures e docs. Tamanho de cartão usa `cards.size_model` (`alice.py:110,127`), não se propõe outro limite.

### Causas e hipóteses
- **Confirmadas:** checks não rejeitam total vazio; a etapa tests não isola stub; medição por resposta/chat, não tentativa física; `finish` preserva mensagem antiga; teto nominal alto; documentação de sprint desatualizada.
- **Não confirmadas:** tokens cobrados por HTTP sem usage, frequência real dos falsos verdes/reparos, formatos alternativos do Vitest, migração segura de planos 4–6 e autoridade externa disponível para ledger/liberação. Não alegar I/K/L/M como travas prontas.

### Justificativa econômica
- Corrigir portões, medição e estado evita aprovações/diagnósticos enganadores antes das próximas features; testes temporários evitam qualquer escrita de fixture no repositório real. Teto 3 reduz limite declarado, mas pode bloquear planos legados: custo de migração não mensurado. Stub custa leitura git/reescrita transitória e precisa prova rigorosa. Documentação pequena evita operar `all` como se contivesse pausa não implementada. Não há economia monetária observada; não gastar créditos para implementar autoridade falsificável.

## Evoluções
| ID | Problema | Evidência — base/retro | Mudança | Arquivos | Teste que prova | Risco | Tipo | Status |
|---|---|---|---|---|---|---|---|---|
| JV6-1 | 0/0 verde | `alice.py:192-200` | detector estreito para total global em `--coverage`, conforme diff v5 | `tools/alice-harness/alice.py`, `tools/alice-harness/tests/test_test_guardrails.py` | mock 0/0 exit 0 falha; cobertura positiva, comando sem coverage e exit 1 mantidos | médio, formato | correção | adiada — aguardando aplicação |
| JV6-2 | checks tests veem implementação anterior | `feature.py:305-339,382-395` | contexto HEAD só no worktree, restore em finally, erro fechado, conforme diff v5 e provas complementares | `tools/alice-harness/feature.py`, `tools/alice-harness/tests/test_feature_orchestrator.py` | git temporário: prévia impl não gera reparo, índice/worktree/mode preservados; falha de git não aprova | médio/alto, restauração | correção | adiada — aguardando aplicação |
| JV6-3 | requisições/tokens Bia omitidos | `bia.py:88-113`; `feature.py:213-234` | contar tentativa na rede/usage recebida e salvar delta inclusive erro, conforme diff v5 | `tools/alice-harness/bia.py`, `tools/alice-harness/feature.py`, `tools/alice-harness/tests/{test_test_guardrails,test_feature_orchestrator}.py` | duas respostas/erro e timeout = tentativas; erro com usage soma tokens; sem usage não inventa | médio, semântica | correção | adiada — aguardando aplicação |
| JV6-4 | `biaBudget` 4–6 permitido | `cards.py:393,443-445` | teto declarado 2..3, fixtures/planner conforme diff v5 | `tools/alice-harness/cards.py`, `tools/alice-harness/roles/planner.md`, `tools/alice-harness/tests/{test_features,test_feature_orchestrator}.py` | 3 aceito, 1/4/6/string recusados; `cmd_feature` recusa 4 antes da chamada | alto, planos legados | **trava** (linha de orçamento) | adiada — aguardando aplicação |
| JV6-5 | mensagens antigas em `done` | `feature.py:195-199`; retro `102951:26-33` | remover apenas `message/red` antigos em `finish`, diff v5 | `tools/alice-harness/feature.py`, `tools/alice-harness/tests/test_feature_orchestrator.py` | error→done limpa; novo erro e contadores permanecem | baixo | correção | adiada — aguardando aplicação |
| JV6-6 | documentos não refletem sprint novo | `AGENTS.md:38-52`; `docs/agents/orquestracao.md:26-38,80`; `cartao-de-tarefa.md:98-115`; `travas.md:109-110` | atualizar seções pertinentes, explicitar revisão antes de Alice como procedimento ainda não imposto por `all`, sincronizar teto após JV6-4 | `docs/agents/{orquestracao,cartao-de-tarefa,travas}.md` | inspeção textual §3.1/CLI e suíte; negativo: não afirmar gate inexistente | médio, divergência código/docs | doc | adiada — aguardando aplicação |
| JV6-7 | I/K/L/M exigem ledger/liberação não forjáveis | `feature.py:183-224`; `bia.py:88-113`; v5:61-62 | nenhuma falsa trava local; futuro mecanismo sob autoridade externa | nenhum agora; futuro núcleo/serviço fora da escrita, integração `bia.py`/`feature.py` | futuro: fraude plano/estado não libera; débito atômico antes de cada retry, falha fecha | alto, falsa segurança | trava futura | adiada — autoridade externa fora da escrita |
| JV6-8 | resume ID/quota bruta/Abacus e commits/gatilho extra | v5:64-65; v2:109-152 | não alterar sem prova; recusar commits/gatilho duplicado | nenhum | futura reprodução ID ambíguo e payload real; gatilho com atraso medido | médio, corrida | correção | adiada (ID/quota/env sem prova); recusada (commits/gatilho) |

### JV6-1 — cobertura não vazia
- **Causa e comportamento atual:** `run_cmd` repassa exit 0; **pretendido:** total global 0/0 jamais verde nos consumidores Alice/Bia/feature. **Implementação mínima:** detector de `All files | Unknown% (0/0)` somente em comando com `--coverage`; retorno não zero e diagnóstico.
- **Fora do escopo:** inferir cobertura quando não há tabela. **Dependências e ordem:** primeiro. **Prova de regressão:** mock de `CompletedProcess` falha antes da alteração, passa depois; negativos: total positivo, texto não global e comando comum, código prévio 1. **Compatibilidade:** CLI/config iguais; consumidores de checks recebem reprovação nova; custo O(saída). **Auditoria:** não aplicável. **Autorização:** v6/v5. **Custo/benefício esperado:** integridade sem economia quantificável. **Resultado observado:** pendente. **Motivo do status:** aguardando aplicação.

### JV6-2 — checks no stub sem alterar índice
- **Causa e comportamento atual:** os dois lotes consultam worktree; `with_stub` existente usa checkout do índice. **Pretendido:** checks da etapa tests consultam HEAD sem mudar índice e com worktree restaurado mesmo na exceção. **Mínimo:** contexto de snapshot de bytes/modo/existência para paths de implement; leitura `git show HEAD:path`; troca transitória e `finally`; falha git vira erro, nunca aprovação.
- **Fora:** reestruturar complemento `with_stub`, produto. **Dependências:** após JV6-1. **Prova:** fixture git em `TemporaryDirectory` com worktree, staged diferente, modo, caminho ausente do HEAD e exceção; checks sobre stub não geram reparo falso, falha não aprova. Não usar `docs/plano/**` ou `runs/**` reais. **Compatibilidade:** CLI/config iguais; consumidor `feature tests` muda para TDD pretendido; I/O pequeno. **Auditoria:** não aplicável. **Autorização:** v6. **Custo/benefício:** reparo poupado hipotético, risco de escrita transitória exige prova. **Resultado:** pendente. **Status:** aguardando aplicação; parar se restauração não comprovável.

### JV6-3 — medir tentativas da Bia
- **Causa:** USAGE aumenta só com choices, feature perde delta ao lançar. **Pretendido:** número de tentativas de completions em `bia.USAGE` e tokens informados, sem inferir custo de erro sem usage. **Mínimo:** diff v5 de `bia.chat` e `Orchestrator.ask`; contar antes de `urlopen`, salvar delta em `finally`.
- **Fora:** ledger autoritativo, aumento de reserva, precificação. **Dependências:** após JV6-2. **Prova:** retry resposta com usage sem choices + sucesso, timeout sem tokens e erro na feature, quota prévia não contabiliza completions. **Negativo:** nunca dupla contagem no `plan_run`; `feature.state['biaRequests']` ainda reserva por chat, **não** equivale a tentativas físicas nem a ledger (separação explícita). **Compatibilidade:** CLI/config mesmas; `bia.USAGE`/retro de cartão mudam de sucessos para tentativas, enquanto contador da feature permanece chats; consumidores precisam interpretar corretamente. **Auditoria:** contadores não são trava se não mudar linha de cota. **Autorização:** v6/v5. **Custo:** constante; economia não medida. **Resultado:** pendente. **Status:** aguardando aplicação.

### JV6-4 — teto nominal J
- **Causa:** `(2,6)` permite 4–6. **Pretendido:** barrar plano acima de 3 antes da Bia, sem declarar I–M completos. **Mínimo:** `(2,3)`, fixtures e instrução planner, como diff v5.
- **Fora:** alterar `docs/plano/**`, executar/migrar produto, autenticação de Joel. **Dependência:** após JV6-3; docs JV6-6 dependem deste teste. **Prova:** 3 aceito, 1/4/6/10/str recusados; `cmd_feature` com 4 não chama Bia; negativo: chamadas diretas não protegidas por esta validação. **Compatibilidade:** CLI igual; quebra configuração legado `biaBudget` 4–6 e requer migração por responsável fora do Review. **Auditoria:** **trava — auditoria do Joel**, commit separado pelo runner. **Autorização:** pedido v6/v5; não autoriza aumento. **Custo/benefício:** teto nominal menor, custo de migração desconhecido. **Resultado:** pendente. **Status:** aguardando aplicação.

### JV6-5 — limpeza de diagnósticos
- **Causa:** `finish` atualiza sem remover `message/red`. **Pretendido/mínimo:** descartar apenas os dois campos prévios antes de atualizar status. **Fora:** reescrever estado em `docs/plano/**`. **Dependências:** após JV6-2/3, mesmo arquivo. **Prova:** error→done sem mensagem/red; novo erro e segundos/requisições preservados. **Negativo:** não apagar contadores. **Compatibilidade:** CLI/config iguais; consumidores retro/estado deixam de receber diagnóstico vencido; custo mínimo. **Auditoria:** não aplicável. **Autorização:** v6/v5. **Resultado:** pendente. **Status:** aguardando aplicação.

### JV6-6 — sprint documentado sem gate fictício
- **Causa:** documentos anteriores divergem da ordem §3.1 e do teto testado. **Pretendido:** explicitar planejamento, refinamento, testes prontos/revisados, Alice, validação/review, entrega e retro/Jorge; distinguir etapa operativa de proteção automática. **Mínimo:** alterar apenas trechos relevantes dos três docs; 2–3 somente após JV6-4.
- **Fora:** editar `AGENTS.md`, afirmar que `--stage all` interrompe para revisão externa ou inventar commit/approval. **Dependências:** JV6-4/5. **Prova:** conferir texto contra `AGENTS.md:38-52`, `feature.py:538-553`, inspeção negativa e suíte verde; não existe teste automático que comprove revisão externa. **Compatibilidade:** CLI/config sem mudança; leitores Claude/Alice/Bia/Jorge ganham instrução de sequência, sem mudança executável. **Auditoria:** não aplicável. **Autorização:** v6 explícita. **Custo:** pequena edição, benefício qualitativo. **Resultado:** pendente. **Status:** aguardando aplicação.

### JV6-7 — autoridade para I/K/L/M
- **Causa:** orçamento/estado locais e retries permitem bypass; nenhuma credencial exclusiva de Joel na escrita autorizada. **Pretendido:** reserva atômica durável por tentativa, parada/notificação e liberação apenas autenticada por Joel. **Mínimo agora:** não escrever trava ilusória; JV6-3 mede e JV6-4 limita declaração. **Fora:** núcleo, serviço externo, `.env` real, estados de produto. **Dependências:** projeto/autorização de autoridade externa; não bloqueia JV6-1..6. **Prova futura:** estado, plano e token falso não liberam rede; retry reserva separada, falha de persistência bloqueia, notificação idempotente e liberação autenticada escopada. **Compatibilidade:** nenhuma agora; integração futura afetará API/config e todas as rotas Bia/feature/plan-run. **Auditoria:** trava futura, nenhuma agora. **Autorização:** v6 não amplia escrita. **Custo:** desconhecido, segurança falsa pior que adiamento. **Resultado:** nenhuma alteração agora. **Status:** adiada por autoridade externa fora da escrita, não espera bloqueante.

### JV6-8 — residual sem reprodução
- **Causa:** resume por ID carece regra para duplicados; quota real sem payload; chave Abacus não é chave OpenRouter; commit intermediário e gatilho concorrente não têm evidência de benefício. **Pretendido/mínimo:** nenhuma automação especulativa. **Fora:** produto, segredo e mudanças no runner. **Dependências:** evidência futura, nenhuma para outros IDs. **Prova futura/negativos:** ID ausente/duplicado falha fechado, payload quota e usage real antes de mudar contagem; sem gatilho duplicado. **Compatibilidade:** CLI/config/consumidores intactos. **Auditoria:** não aplicável. **Autorização:** triagem v6. **Custo/benefício:** evita custo/race não medidos. **Resultado:** nenhuma escrita. **Status:** partes adiadas por falta de prova; commit/gatilho recusados.

## O que ficou para Joel decidir
| Decisão | Evolução | Motivo | Opções e recomendação | Bloqueia aplicação? |
|---|---|---|---|---|
| Projeto futuro de autoridade externa/migração de planos legados fora da escrita do Jorge | JV6-7/JV6-4 | estado/plano editáveis; planos 4–6 podem existir em `docs/plano/**` proibidos | núcleo controlado pelo Joel ou serviço com reserva atômica autenticada; recomendar planejar migração antes da próxima feature legada e não afirmar I–M completos | apenas I/K/L/M futuros e planos legados; não JV6-1..6 |

Não há pergunta imprescindível para aplicar correções autorizadas. Este relatório não autoriza mexer em núcleo/planos.

## Execução e suíte
| Momento | Evolução | Resultado | Executados | Falhas | Erros | Ignorados | Evidência |
|---|---|---|---:|---:|---:|---:|---|
| Referência | — | VERDE informado | 231 | não informado | não informado | não informado | pedido runner v6 |
| Regressão antes, se viável | JV6-1..5 | aguardando aplicação | — | — | — | — | — |
| Após cada evolução | JV6-1..6 | aguardando `run_tests()` | — | — | — | — | — |
| Final — runner | — | aguardando runner | — | — | — | — | — |
- **Comando:** `python3 -m unittest discover -s tests` em `tools/alice-harness`.
- **Anomalias de descoberta/contagem:** não aferidas nesta análise; zero testes não é verde; final ≥231.
- **Tentativas e falhas intermediárias:** nenhuma nesta fase; diff v5 fornecido termina antes do fim do teste, requer reconstrução delimitada; v5 238 verdes mas runner recusa reportada como bug corrigido pelo pedido.
- **Desvios do relatório inicial:** nenhum nesta fase. **Resultado transacional:** pendente. **Commit:** só runner. **Se não aplicado:** registrar impedimento/diff via runner. **Evoluções revertidas:** nenhuma ainda.

## Custo da execução do Jorge
| Medida | Valor | Fonte/observação |
|---|---:|---|
| Requisições à API, incluindo retries | indisponível | runner |
| Tokens de entrada | indisponível | usage |
| Tokens de saída | indisponível | usage |
| Tokens totais | indisponível | sem dupla contagem; runner |
| Entrada em cache | indisponível | usage |
| Raciocínio | indisponível | runner informa se já na saída |
| Custo monetário | indisponível | API/runner e tabela de preços |
| Chamadas de ferramentas / suítes | indisponível / 0 nesta análise | runner |
| Duração total | indisponível | runner |
- **Cobertura da medição:** parcial até fechamento pelo runner. **Estimativas:** só qualitativas; nenhuma economia realizada demonstrada. **Consumo de Bia:** nenhum no Review; regressões usarão mocks, sem rede. **Conclusão:** reaplicar correções pequenas e verificáveis antes das próximas features, sem apresentar teto nominal como ledger completo.

---
## Verificação do runner
- Status: **aplicada**
- Base: `5546b77dd72143fff445be082bf79eef303ab415`
- Suíte final: VERDE, 238 testes (referência 231)
- Arquivos alterados: docs/agents/cartao-de-tarefa.md, docs/agents/orquestracao.md, docs/agents/travas.md, tools/alice-harness/alice.py, tools/alice-harness/bia.py, tools/alice-harness/cards.py, tools/alice-harness/feature.py, tools/alice-harness/roles/planner.md, tools/alice-harness/tests/test_feature_orchestrator.py, tools/alice-harness/tests/test_features.py, tools/alice-harness/tests/test_test_guardrails.py
- Rodadas de reparo usadas: 0
- Revertidos só estes (invariante): nenhum
- Travas (commit separado `Trava: sim`, auditoria do Joel): nenhuma
- Problemas: nenhum

## Resumo do finish
IDs implementados como candidatos à validação final do runner: JV6-1 (cobertura global 0/0 reprova), JV6-2 (checks da etapa tests sobre stub HEAD com restauração do worktree e sem alterar índice), JV6-3 (tentativas físicas e usage informado da Bia; delta de tokens em erro), JV6-4 (teto declarado biaBudget 2..3), JV6-5 (limpeza de diagnósticos vencidos), JV6-6 (documentos alinhados ao sprint, sem afirmar gate inexistente). JV6-7 adiada: I/K/L/M exigem ledger e autenticação fora dos caminhos autorizados; JV6-8 adiada quanto a resume ID/quota/env sem evidência e recusada quanto a commits intermediários/gatilho duplicado. Arquivos alterados: tools/alice-harness/{alice.py,bia.py,cards.py,feature.py,roles/planner.md,tests/test_test_guardrails.py,tests/test_feature_orchestrator.py,tests/test_features.py}; docs/agents/{orquestracao.md,cartao-de-tarefa.md,travas.md}. Trava aplicada como candidata: JV6-4, linha de orçamento em cards.py, redução 6→3; auditável pelo Joel em commit separado pelo runner. Testes: regressões antes das correções JV6-1 (232, 1 falha), JV6-2 (234, 2 falhas), JV6-3 (236, 1 falha e 1 erro), JV6-4 (237, 2 falhas), JV6-5 (238, 1 falha); após cada evolução suíte VERDE respectivamente 232, 234, 236, 237, 238 e 238 (JV6-6), referência 231; execução final e commit ainda exclusivos do runner. Desvios: diff v5 fornecido estava truncado no teste de retries; reconstruído apenas trecho necessário. Stub e fixtures git usam diretórios temporários; testes v5 adicionais de ausência de HEAD/mode não foram adicionados, portanto não afirmar cobertura completa de todos os caminhos de restauração. Contador da feature continua por chat e não representa tentativas de rede/ledger; `--stage all` ainda não impõe pausa de revisão. Nenhuma pergunta enviada ao Joel; decisão futura sobre autoridade/migração consta no relatório. Não foi feito commit nem entrega de produto.

## Custo da execução do Jorge (runner)

| Medida | Valor |
|---|---:|
| Modelo(s) | gpt-6-sol |
| Requisições | 55 (falhas re-tentadas: 0, sem usage: 0) |
| Tokens de entrada | 525800 |
| Entrada em cache | 3628872 |
| Tokens de saída | 12873 |
| Raciocínio (já na saída) | 0 |
| Créditos Abacus | 2360.42 |
| Passos análise / aplicação | 6 / 49 |
| Suítes rodadas | 11 |
| Início / fim | 2026-11-16T17:40:10-03:00 / 2026-11-16T17:43:29-03:00 |
