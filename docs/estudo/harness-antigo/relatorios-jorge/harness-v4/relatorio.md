# harness-v4 — checks verificáveis e teto da Bia

## Identificação
- **Versão:** harness-v4
- **Data:** 2026-11-16T17:15:32-03:00 (recebida; conclusão pelo runner)
- **Execução:** Review harness-v4; ID específico não fornecido.
- **Estado da versão:** proposta
- **Escopo recebido:** reaplicar correções revertidas v2/v3; prioridade cobertura 0/0, checks de tests contra stub, tentativas/tokens Bia, orçamento I–M; demais itens somente se justificados. 40 passos análise, 60 aplicação, leitura até 400 linhas, teto 3000 créditos.
- **Fontes recebidas:** pedido; `tools/jorge/logs/harness-v{1,2,3}/relatorio.md`; `tools/alice-harness/runs/retro-20261116-{102615,102951}.md`; código/testes citados abaixo. Nenhuma retro nova indicada.
- **Base git:** `bad48b383cb0c955a06675093a6700978dca0683`, informada pelo runner; branch `docs/mvp-planning`, worktree `jorge/harness-v4`.
- **Workspace inicial:** worktree isolado informado; limpeza não aferível nas ferramentas de leitura.
- **Modelo/provedor efetivamente utilizados:** `gpt-6-sol` informado, metadados efetivos da API não disponibilizados nesta fase.
- **Autorizações de Joel:** ordem de aplicar autonomamente o que for comprovável, inclusive travas testadas; não amplia caminhos nem fornece autoridade externa para liberação extraordinária.
- **Suíte de referência:** VERDE, 231 testes, `python3 -m unittest discover -s tests` em `tools/alice-harness`, informada pelo runner; falhas/erros/ignorados não discriminados.

## Diagnóstico
### Fatos confirmados
- V2 e v3 ficaram **não aplicados**, embora finais VERDES de 238 e 239 testes: verificação final registrou, respectivamente, `ools/alice-harness/alice.py` e `ocs/agents/cartao-de-tarefa.md` como caminhos proibidos (primeira letra perdida); `harness-v2/relatorio.md:201-214`, `harness-v3/relatorio.md:130-140`. Tratar toda escrita como caminho absoluto relativo à raiz iniciado literalmente `tools/` ou `docs/`; não supor que a suíte sozinha garante o commit.
- `alice.py:192-200` aceita saída de cobertura 0/0 com exit zero; `bia.py:128-129`, `feature.py:298-303,412-438,506-520` e `alice.py:715-723` reutilizam esse resultado. Incidente de vitest `All files | Unknown% (0/0)` registrado no v2/v3, saída bruta indisponível.
- `feature.py:305-339` executa os dois lotes da etapa tests sobre a implementação atual; `:265-269` já usa stub HEAD no contexto, mas `with_stub` em `:382-395` usa checkout alterando índice e só restaura texto de arquivos existentes. Teste git transacional é condição da correção.
- `bia.py:88-113` tenta até três requisições de rede por `chat`, soma requisições/tokens apenas com `choices`; `feature.py:213-233` soma uma requisição antes de chamar e perde delta em exceção. `alice.py:1266-1327` também lê `USAGE`; `bia.py:344-357,448-456,485-501` e `alice.py:1239-1243` alcançam Bia fora de feature. `cards.py:393,443-445` aceita teto 6; `feature.py:183-224` confia em estado/plano editáveis. A retro `102951:26-33` mostra `tests: done` com mensagem velha `quota` e `4/6` na feature; `102615:22-27` mostra 3/6 e mensagem 4/4: não provar equivalência dessas contagens nem perda real de tokens sem payload.
- `metricas(metrics)` registra 28 runs, 17 concluídos, 60,7%, 1,96 tentativas e 201,2 s em média; `metricas(evolution)` não mede benefício de v2/v3 revertidos. V2 custou 1837,88 e v3 2852,93 créditos Abacus, medidos nos respectivos relatórios, não custo deste Review.

### Causas e hipóteses
- **Confirmada:** falso verde potencial por cobertura vazia, teste no worktree em vez do stub, retries não debitados/relatados como requisições, erro antigo preservado por `dict.update` (`feature.py:195-199`), limite 6 e autoridade de estado/plano falsificável.
- **Não confirmada:** números de requisições/tokens efetivamente perdidos em produção, formato completo do vitest, quantos reparos o stub pouparia, mecanismo de autenticação de Joel disponível, migração de planos 4–6 e viabilidade de ledger independente sob caminhos autorizados. Nenhum arquivo editável pelo agente pode autenticar autorização de Joel.

### Justificativa econômica
- Integridade de checks e medição antes de economia especulativa: cinco regressões pequenas impedem aprovações indevidas e removem diagnósticos falsos; a prova de isolamento custa I/O git temporário. Reduzir teto é risco financeiro prioritário, mas pode bloquear planos legados: reportar explicitamente, sem editar `docs/plano/**`. Livro-caixa append-only local protege contra alteração acidental, não contra agente que possa alterar o próprio livro; não rotular como segurança completa I–M. Ganhos monetários futuros não estimáveis com os dados existentes; limitar superfície e suítes para caber no teto de créditos.

## Evoluções
| ID | Problema | Evidência | Mudança | Arquivos | Teste que prova | Risco | Tipo | Status |
|---|---|---|---|---|---|---|---|---|
| JV4-1 | cobertura 0/0 falsa verde | `alice.py:192-200`; v2:19-22 | reprovar indicador global inequívoco em check de cobertura | `tools/alice-harness/alice.py`, `tools/alice-harness/tests/test_test_guardrails.py` | 0/0 exit 0 falha; positivo e comando não cobertura passam | médio, formatos | correção | adiada — aguardando aplicação |
| JV4-2 | etapa tests usa implementação anterior | `feature.py:305-339,382-395` | contexto stub HEAD no worktree para dois lotes, com snapshot/restauração e falha fechada | `tools/alice-harness/feature.py`, `tools/alice-harness/tests/test_feature_orchestrator.py` | fixture git: prévia impl não dispara reparo; índice/modes preservados; erro não aprova | médio/alto, I/O transitório | correção | adiada — aguardando aplicação |
| JV4-3 | tentativas e tokens Bia omitidos | `bia.py:88-113`; `feature.py:213-233`; `alice.py:1266-1327` | contar cada tentativa de completions e usage disponível mesmo sem choices; delta de erro da feature | `tools/alice-harness/bia.py`, `tools/alice-harness/feature.py`, testes correspondentes | duas tentativas = duas, erro com usage agrega, erro sem usage não inventa | médio, mudança semântica | correção (linha de cota se tocada: trava) | adiada — aguardando aplicação |
| JV4-4 | teto J ainda 6 | `cards.py:393,443-445`; `tests/test_features.py:24,42-45` | teto de validação 3 e alinhamento de fixtures/docs sem elevar cotas | `tools/alice-harness/cards.py`, `tools/alice-harness/tests/test_features.py`, `tools/alice-harness/tests/test_feature_orchestrator.py`, `tools/alice-harness/roles/planner.md`, `docs/agents/orquestracao.md` | 3 aceito, 4 e legado 6 rejeitados | alto, planos legados | **trava** (linha de orçamento) | adiada — aguardando aplicação |
| JV4-5 | mensagens velhas persistem | `feature.py:195-199`; retro `102951:26-33` | limpar `red/message` efêmeros em `finish` | `tools/alice-harness/feature.py`, `tools/alice-harness/tests/test_feature_orchestrator.py` | erro→done limpa; novo erro/segundos conservados | baixo | correção | adiada — aguardando aplicação |
| JV4-6 | ledger I, parada/notificação K e liberação L/M dependem de autoridade | `feature.py:183-224`; `bia.py:88-113`; v2:79-92, v3:66-70 | não criar liberação forjável nem prometer livro-caixa autoritativo; exigir mecanismo exclusivo de Joel fora deste worktree | nenhuma escrita autorizada para autoridade; integração futura em `tools/alice-harness/{bia,feature}.py` e núcleo/serviço externo **fora da lista** | falsificar estado/liberação não concede rede; retries/reserva atômica, falha de persistência bloqueia | alto, segurança financeira | trava | adiada — impedimento de autoridade/invariante, não aguardando conversa |
| JV4-7 | resume por ID, Abacus, cota bruta, commits/gatilho adicional | v2:109-152; v3:80-82 | preservar CLI e fluxo existentes até reprodução; recusar gatilho/commit duplicado | nenhum | reprodução/payload antes de mudança | médio, falsa compatibilidade | correção | adiada (ID/cota/env); recusada (commit/gatilho) |

### JV4-1 — cobertura não vazia
- **Causa e comportamento atual:** `run_cmd` devolve exit 0 mesmo se tabela global mostrar `Unknown% (0/0)`.
- **Comportamento pretendido/implementação mínima:** identificar estritamente o total global vazio em comando `--coverage`, retornar erro legível sem alterar outros checks ou falsificar resultados quando tabela ausente.
- **Fora do escopo:** produto/vitest e inferir cobertura sem total mensurado. **Dependências e ordem:** primeira.
- **Prova de regressão/casos negativos:** mock de subprocess: indicador global zero antes passa incorretamente, depois falha; cobertura positiva, texto `0/0` não global ou comando comum permanecem conforme exit original; erro já existente não vira sucesso.
- **Compatibilidade:** CLI/config preservadas; consumidores Alice, Bia e feature veem falha nova verdadeira; custo de varredura O(saída), economia não medida. **Auditoria:** não aplicável. **Autorização:** escopo. **Resultado observado:** pendente. **Motivo:** aguardando aplicação.

### JV4-2 — testes contra stub com restauração
- **Causa e comportamento atual:** checks da etapa tests veem implementação anterior; reutilizar `with_stub` pode alterar índice e deixar conteúdo novo de fora.
- **Comportamento pretendido/implementação mínima:** para cada lote de checks, guardar existência, bytes e modo do worktree dos paths de implementação e restaurar no `finally`; ler HEAD sem atualizar índice; preparação que falha interrompe etapa sem `done`. Não mexer no complemento sem prova dedicada.
- **Fora do escopo:** alterações reais de produto/plano. **Dependências e ordem:** após JV4-1, independente funcionalmente.
- **Prova de regressão/casos negativos:** git tmp com stub no HEAD, implementação diferente no índice e worktree, e path sem HEAD; testes bons não causam reparo, testes ruins provocam um reparo ainda contra stub; exceção ou git falho preserva índice/worktree, não aprova etapa. Testar modo/existência.
- **Compatibilidade:** CLI/config preservadas; consumidores `stage_tests` passam a verificar contrato TDD correto; I/O pequeno, economia Bia hipotética. **Auditoria:** não aplicável. **Autorização:** escopo. **Resultado observado:** pendente. **Motivo:** aguarda prova transacional.

### JV4-3 — medição de rede da Bia
- **Causa e comportamento atual:** `USAGE` só contabiliza resposta com `choices`; feature soma contagem por chat, não por tentativa física, e ignora tokens em exceção.
- **Comportamento pretendido/implementação mínima:** incrementar tentativas ao iniciar `urlopen` de completions, contar `usage` disponibilizado por resposta bem formada inclusive erro sem choices, preservar erro sem usage como desconhecido, registrar delta em `finally` no `ask`; não contar chamada de quota como completions.
- **Fora do escopo:** estimar tokens/preço ausentes ou mudar a cota do provedor. **Dependências:** antecede JV4-4 para distinguir teto nominal de consumo real.
- **Prova/casos negativos:** duas tentativas simuladas (sem dormir) dão duas requisições; erro com usage contabiliza; erro sem usage não inventa tokens; feature registra delta também se `bia_chat` lançar; plan-run segue lendo diferença sem double count.
- **Compatibilidade:** CLI/config iguais; `USAGE['biaRequests']` muda de sucessos para tentativas e relatórios consumidores devem nomear essa semântica; custo constante, economia não demonstrada. **Auditoria:** se alteração incidir em linha de cota/reserva, marcar trava para auditoria separada; contadores são correção. **Autorização:** escopo. **Resultado:** pendente. **Motivo:** aguardando aplicação.

### JV4-4 — validação J (teto três)
- **Causa e comportamento atual:** validador aceita até seis, docs/fixtures replicam valor 4/6.
- **Comportamento pretendido/implementação mínima:** mudar limite superior do validador para três; harmonizar testes/docs sem alterar `docs/plano/**`; rejeitar explicitamente plano legado acima de 3 antes da chamada.
- **Fora do escopo:** migração real dos planos legados, simular livro-caixa/autorização. **Dependências:** após JV4-3; não alegar que esta validação protege rotas diretas da Bia.
- **Prova/casos negativos:** teste 3 aceito e 4/6 recusados; `cmd_feature` recusa plano 4 antes de `ops.bia_chat`; fixture antiga de happy path ajustada a três sem mascarar teto.
- **Compatibilidade:** quebra de configuração `biaBudget` 4–6, sem alteração de CLI; consumidores devem migrar planos fora deste Review antes de rodar; custo de migração desconhecido, benefício financeiro qualitativo. **Auditoria:** **trava — auditoria do Joel** na linha de orçamento, commit separado pelo runner. **Autorização:** ordem explícita. **Resultado:** pendente. **Motivo:** aguardando aplicação; não editar plano proibido.

### JV4-5 — limpar diagnóstico obsoleto
- **Causa/comportamento atual:** `dict.update` retém mensagem/red da execução anterior, retro imprime erro de etapa já pronta.
- **Comportamento pretendido/implementação mínima:** antes do update de `finish`, eliminar apenas `message` e `red` anteriores; preservar contadores e segundos.
- **Fora do escopo:** reescrever estados persistidos do produto. **Dependências:** após JV4-2/3, mesmo arquivo.
- **Prova/casos negativos:** failed→done remove erro; novo erro o registra; segundos e contadores não caem. **Compatibilidade:** CLI/config inalteradas; retro deixa de mostrar erro vencido; custo mínimo, benefício qualitativo. **Auditoria:** não aplicável. **Autorização:** escopo. **Resultado:** pendente. **Motivo:** aguardando aplicação.

### JV4-6 — limites da autoridade I–M
- **Causa/comportamento atual:** estado/plano na árvore são manipuláveis; `chat` aceita retries sem reserva por tentativa; não existe no escopo autoridade exclusiva de Joel nem canal de notificação autenticado demonstrado.
- **Comportamento pretendido:** I débito atômico em ledger append-only independente antes de cada tentativa, J teto 3, K parar e notificar, L/M liberar apenas por Joel, autenticação fora do controle dos agentes.
- **Implementação mínima:** nenhuma escrita de falsa autoridade; implementar apenas J em JV4-4 e medição real em JV4-3. Uma solução completa futura precisará API/núcleo ou serviço do Joel e desenho de notificação + migração, fora da lista de escrita, com integração testada nos chamadores diretos/plan-run/feature.
- **Fora do escopo:** arquivos de liberação editáveis, alteração de `.env`/`docs/plano/**`/núcleo, elevar limite. **Dependências:** autoridade externa antes de I/K/L/M completos.
- **Prova futura/casos negativos:** plano/estado/liberação falsificados não destravam, dois retries consomem duas reservas, indisponibilidade bloqueia, liberação autenticada tem escopo e expira, notificação enviada uma vez sem sucesso falso. CLI/config/consumidores de liberação futura exigirão migração; custo externo não estimável. **Auditoria:** trava futura — auditoria do Joel; nenhuma declaração de I–M completos agora. **Autorização:** ordem autônoma não altera soberania do núcleo. **Resultado:** bloqueio técnico comprovado, não aguardando pergunta. **Motivo:** adiada por invariante/autoridade, enquanto JV4-3/JV4-4 seguem.

### JV4-7 — residual não provado
- **Causa/decisão:** `resume` por ID não tem regra de desambiguação; dados brutos de cota não comprovam aritmética; Bia usa somente OpenRouter (`bia.py:77-85`), não inferir chave Abacus; `plan-run` não commita por design e timer já varre conclusão.
- **Implementação mínima:** nenhuma. **Fora do escopo:** produto/credenciais/novo gatilho. **Dependências/prova futura:** execução duplicada/ausente por ID deve falhar fechado, payload real de cota para correção; medir atraso de timer antes de gatilho. **Casos negativos:** não escolher ID ambíguo, não prometer tokens indisponíveis. **Compatibilidade:** CLI/config/consumidores inalterados; evita custo especulativo. **Auditoria:** não aplicável. **Autorização:** avaliação da fila. **Resultado:** nenhuma escrita. **Motivo:** adiada por evidência insuficiente; commits e gatilho recusados pelo risco de corrida.

## O que ficou para Joel decidir
| Decisão | Evolução | Motivo | Opções e recomendação | Bloqueia aplicação? |
|---|---|---|---|---|
| Autoridade externa e migração, a planejar fora deste Review | JV4-6 | I/K/L/M completos precisam núcleo/serviço exclusivo de Joel, fora da escrita; planos 4–6 em `docs/plano/**` proibidos | serviço autenticado com reservas atômicas ou núcleo sob Joel; recomendar não liberar por arquivo editável e migrar planos antes da execução | somente futuro I/K/L/M, não JV4-1..5 |

Não há pergunta assíncrona: não é preciso resposta para correções autorizadas; relatório não concede permissão sobre núcleo ou planos.

## Execução e suíte
| Momento | Evolução | Resultado | Executados | Falhas | Erros | Ignorados | Evidência |
|---|---|---|---:|---:|---:|---:|---|
| Referência | — | VERDE informado | 231 | não informadas | não informados | não informados | pedido do runner |
| Regressão antes da correção | JV4-1..5 | pendente aplicação | — | — | — | — | — |
| Após evolução | JV4-1..5 | pendente `run_tests()` por evolução | — | — | — | — | — |
| Final — runner | — | pendente | — | — | — | — | — |
- **Comando:** `python3 -m unittest discover -s tests`, no harness.
- **Anomalias de descoberta/contagem:** nenhuma aferida; final ≥231, 0 testes não é verde.
- **Tentativas e falhas intermediárias:** nenhuma nesta análise; v2/v3 voltaram por caminhos truncados mesmo com suítes verdes. Verificar prefixos completos de cada arquivo alterado antes de encerrar aplicação.
- **Desvios do relatório inicial:** nenhum ainda.
- **Resultado transacional:** aguardando runner; sem commit/diff alegado.
- **Commit:** a preencher pelo runner.
- **Se não aplicado:** reportar motivo e diff conforme runner.
- **Evoluções revertidas:** nenhuma nesta fase.

## Custo da execução do Jorge
| Medida | Valor | Fonte/observação |
|---|---:|---|
| Requisições à API, incluindo retries | indisponível | runner |
| Tokens de entrada | indisponível | usage da API |
| Tokens de saída | indisponível | usage da API |
| Tokens totais | indisponível | runner, sem dupla contagem |
| Entrada em cache | indisponível | metadados API |
| Raciocínio | indisponível | runner, esclarecer inclusão na saída |
| Custo monetário | indisponível | preços/usage não fornecidos nesta fase |
| Chamadas de ferramentas / suítes | runner / 0 na análise | runner agrega |
| Duração total | indisponível | runner |
- **Cobertura da medição:** parcial nesta fase; runner preencherá chamadas com usage/retries.
- **Estimativas separadas dos valores medidos:** ganhos qualitativos e não observados; números de runs e custos anteriores provêm das fontes indicadas.
- **Consumo de Bia:** nenhum pelo Review; testes propostos só dublês.
- **Conclusão:** priorizar integridade mecânica sem prometer economia; evitar terceira reversão por caminho truncado e evitar afirmar segurança I–M sem autoridade independente.

---
## Verificação do runner
- Status: **nao_aplicada**
- Base: `bad48b383cb0c955a06675093a6700978dca0683`
- Suíte final: VERDE, 234 testes (referência 231)
- Arquivos alterados: ools/alice-harness/bia.py, tools/alice-harness/cards.py, tools/alice-harness/feature.py, tools/alice-harness/roles/planner.md, tools/alice-harness/tests/test_feature_orchestrator.py, tools/alice-harness/tests/test_features.py, tools/alice-harness/tests/test_test_guardrails.py
- Rodadas de reparo usadas: 2
- Revertidos só estes (invariante): ools/alice-harness/bia.py
- Travas (commit separado `Trava: sim`, auditoria do Joel): nenhuma
- Problemas: escrita proibida: ools/alice-harness/bia.py (permitido: tools/alice-harness/**, docs/agents/**, .agents/policy.yaml, tools/jorge/agente/**; nunca segredos, núcleo, estado, apps, packages)

## Resumo do finish
Reparo 2/2: runner identificou `ools/alice-harness/alice.py` como escrita proibida (prefixo `t` ausente na verificação), repetindo causa de v2. Sem contornar invariante, reverti apenas JV4-1 em tools/alice-harness/alice.py e removi seu teste em tools/alice-harness/tests/test_test_guardrails.py; cobertura 0/0 permanece NÃO corrigida e JV4-1 fica adiada, em vez de anunciar proteção inexistente. Suíte após reparo: VERDE, 234 testes (referência 231), 0 falhas/erros; runner ainda deve validar diff/commit. Preservei para verificação JV4-2 (stub), JV4-3 (contadores/tokens), JV4-4 (teto 3, trava a auditar) e JV4-5 (diagnósticos); documentos docs/agents/orquestracao.md já haviam sido restaurados no reparo anterior por `ocs/agents/orquestracao.md`. Arquivos ainda alterados: tools/alice-harness/bia.py, cards.py, feature.py, tests/test_test_guardrails.py, tests/test_feature_orchestrator.py, tests/test_features.py, roles/planner.md. JV4-6 I/K/L/M adiada por falta de autoridade independente, JV4-7 adiada/recusada como registrado; nenhuma pergunta a Joel; não afirmo commit. Nota: a orientação histórica docs/agents/orquestracao.md ainda cita 2–4/2–6 apesar do validador novo 2–3; corrigir somente quando validação de caminhos permitir sem perder outras mudanças.

## Custo da execução do Jorge (runner)

| Medida | Valor |
|---|---:|
| Modelo(s) | gpt-6-sol |
| Requisições | 57 (falhas re-tentadas: 0, sem usage: 0) |
| Tokens de entrada | 582790 |
| Entrada em cache | 3987021 |
| Tokens de saída | 12051 |
| Raciocínio (já na saída) | 0 |
| Créditos Abacus | 2571.93 |
| Passos análise / aplicação | 5 / 52 |
| Suítes rodadas | 13 |
| Início / fim | 2026-11-16T17:15:32-03:00 / 2026-11-16T17:19:02-03:00 |
