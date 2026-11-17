# harness-v8 — aceite de feature, integridade da revisão e fonte única de configuração

## Identificação
- **Versão:** harness-v8
- **Data:** 2026-11-16T23:02:57-03:00 (data recebida; horário desta análise não aferido)
- **Execução:** Review harness-v8; ID interno não fornecido.
- **Estado da versão:** proposta
- **Escopo recebido:** pedido de Joel de 16/11: aceite de feature, quadro compartilhado, perfil, políticas, textos, cobertura da revisão e custo; limite 40 passos de análise/60 de aplicação, leitura ≤400 linhas, teto 3000 créditos.
- **Fontes recebidas:** pedido do Joel; `tools/jorge/logs/harness-v1..v6/relatorio.md` (ênfase v6); `tools/alice-harness/runs/retro-20261116-181101.md`, `retro-20261116-181129.md`, `retro-20261116-175209.md`, `runs/E4-T09/20261116-180957/state.json`; métricas do harness; código e documentos referidos abaixo. Sem retro indicada expressamente.
- **Base git:** `e7ffd877eb899831d5a8e2858e09d4730040f2fe`, branch `docs/mvp-planning`; worktree `jorge/harness-v8` (informado).
- **Workspace inicial:** isolamento informado; limpeza não comprovável pelas ferramentas disponíveis.
- **Modelo/provedor efetivamente utilizados:** `gpt-6-sol` informado; provedor e metadados efetivos indisponíveis nesta fase.
- **Autorizações de Joel:** pedido recebido para correções e travas com prova, sem permissão para `docs/plano/**`, `.env` real ou núcleo; nenhuma autorização para elevar cota.
- **Suíte de referência:** VERDE, 238 testes, `python3 -m unittest discover -s tests` em `tools/alice-harness`, informada pelo runner; demais contagens não detalhadas.

## Diagnóstico
### Fatos confirmados
- `feature.py:553-583` termina review em `ready`; `runner.py:506-516` exige todas as etapas `done`; estados versionados `docs/plano/E4-F02/estado.json:46-47` e `E4-F04/estado.json:39-40` guardam `ready`. Retro de F04 (`runs/retro-20261116-181129.md:3-5`) termina na auditoria. A correção do gatilho de **fim de leva** não cabe no harness: `runner.py:563-579` conhece somente features, retros e caixa.
- `feature.py:571-583` escreve `(sem tabela)` e retorna `ready` mesmo sem saída de cobertura. `alice.py:192-200` só barra formato literal `All files | Unknown% (0/0)` para comando com `--coverage`. `bia.py:128-129` e `feature.py:118-119` reutilizam `run_cmd`, mas revisão também precisa de portão próprio (erro 17).
- `alice.py:67-78` escolhe silenciosamente `gemma` sem configuração; `models.yaml:1-4` não tem `default`; `README.md:68`, `.env.example:10-11` e `orquestracao.md:23-24` repetem valores. `alice.py:883` registra perfil/modelo na métrica, sem anúncio da origem antes da execução.
- `.agents/policy.yaml:41-42` inclui `tools/alice-harness/*`, mas `policy.default.yaml:39-68` não; nenhum dos dois inclui `tools/jorge/*`. `policy.py:6-40` substitui listas inteiras, permitindo override retirar proteções. `Guard.check_write` em `alice.py:180-190` permite caminhos explicitamente presentes em `allowedPaths` apesar de `protectedWrite`; portanto **padrões de política não constituem proibição absoluta** para cartões deliberadamente autorizados. Bia escreve diretamente em `feature.py:504`/`bia.py`, sem `Guard`: não anunciar proteção mecânica da Bia antes de provar seus pontos de escrita.
- `README.md:35` fala em 150 linhas mas `alice.py:123-127,778` usa `cards.size_model`; `bia.py:20-24` diz que Alice escreve testes; `jorge/agente/jorge.md:5` diz timer diário enquanto `nucleo/systemd/jorge-auto.timer` diz horário. `claude_usage.py:82-97` faz `git log -S 'id: <ID>' -- docs/plano`: cartões em `docs/plano/<F>.yaml` com sintaxe ou histórico diferente não aparecem; `window:37-44` compara timestamps lexicograficamente e não normaliza fusos.
- `metricas(metrics)` informou 29 execuções, 18 done (62,1%), média 1,97 tentativas e 196,5 s; `metricas(evolution)` mostra grupos por hash, mas não prova ganho de nenhuma proposta desta versão. Relatórios v1–v6 registram 0/0, orçamento 2..3 e limites de autoridade externa; não repetir propostas especulativas de ledger.

### Causas e hipóteses
- **Confirmadas:** ausência de ação de aceite, review sem validação da cobertura, configuração duplicada e fallback silencioso, política default incompleta, textos legados, busca textual do custo e janela sem parsing de fuso.
- **Não confirmadas:** quantidade de retros ausentes apenas por `ready` (timer também reage a retros); origem exata e layout de todas as filas/NOTAS-ALICE; possibilidade de proteger todas as rotas da Bia com política sem quebrar `test-author`; formato de outras ferramentas de cobertura; custo real de criar quadro sem contrato de dados para leva e filas. Nenhuma economia realizada alegada.

### Justificativa econômica
- Priorizar portão de revisão e aceite: evitam verde falso e reconhecem entrega; testes temporários sem rede. Perfil/documentação são pequenos e reduzem divergência recorrente. Uma nova fonte mutável de filas sem fonte autoritativa exigiria integração nos múltiplos consumidores e poderia mentir aos agentes: adiar o quadro completo até contrato de entrada e garantia de atualização em cada mudança, não criar arquivo decorativo. Custo e benefício monetários ainda não estimáveis; execução limitada a alterações cirúrgicas.

## Evoluções
| ID | Problema | Evidência | Mudança | Arquivos | Teste que prova | Risco | Tipo | Status |
|---|---|---|---|---|---|---|---|---|
| JV8-1 | aceite não fecha feature | `feature.py:553-604`, `runner.py:506-516`; estados F02/F04 | `feature accept <F>` só com plano/estado válidos, review `ready`, etapas anteriores `done`; idempotência de `done`; sem aceitar por execução normal | `tools/alice-harness/{alice.py,feature.py,tests/test_feature_orchestrator.py}`, `docs/agents/orquestracao.md`, README | ready→done persistido, pending/escalated/estado inválido recusados, repetição segura; `all` não desfaz aceite | médio, CLI/estado | correção | adiada — aguardando aplicação |
| JV8-2 | revisão final aprova cobertura ausente | `feature.py:556-583`; `alice.py:192-200` | antes de escrever `revisao-final.md` ou marcar `ready`, exigir check `--coverage` com tabela global e total positivo, sem exit vermelho; falha como erro 17 com motivo | `tools/alice-harness/{feature.py,tests/test_feature_orchestrator.py}` | sem tabela/0/0/exit!=0 falham; total positivo passa | médio, formato Vitest | correção | adiada — aguardando aplicação |
| JV8-3 | perfil default silencioso | `alice.py:67-78`, `models.yaml:1`, README:68 | `default: qwen35` em models.yaml; resolver env de processo > `.env` > YAML, anunciar origem, perfil e modelo no início dos comandos que invocam Alice; preservar override explícito | `tools/alice-harness/{alice.py,models.yaml,tests/test_profiles.py,README.md,.env.example}`, `docs/agents/orquestracao.md` | default YAML sem env, prioridades e erro desconhecido; mensagem anterior à chamada | baixo/médio, startup | correção | adiada — aguardando aplicação |
| JV8-4 | duas políticas com lacuna | `.agents/policy.yaml:41`, `policy.default.yaml:39-68`, `policy.py:36-40` | fonte única para proteções obrigatórias default com herança sem remoção no override; acrescentar caminhos do harness e Jorge; testar entradas de Guard e rota Bia sem alegar proteção se não comprovada | `tools/alice-harness/{policy.default.yaml,policy.py,tests/test_policy.py}`, `.agents/policy.yaml` se redução a override segura | sem override, com override mínimo/removendo listas: ambos protegidos; exceção deliberada por allowedPaths e Bia coberta ou item explicitamente adiado | alto, autorização de escrita | trava — auditoria do Joel | adiada — aguardando aplicação condicionada à prova de rotas Bia |
| JV8-5 | custo omite cartões/local e fuso | `claude_usage.py:37-44,82-97`; `alice.py:1177-1202` | descobrir primeiro commit dos IDs nos YAML em docs/plano sem depender de `id: ` literal; converter ISO com offset para UTC antes de filtrar, manter API e UTC existente | `tools/alice-harness/{claude_usage.py,tests/test_claude_usage.py,README.md}` | commit temporário com cartão em `<F>.yaml` acha início; ausente/ambíguo falha sem atribuir custo; limites +03/-03 incluem/excluem mensagens corretas | médio, histórico/tempo | correção | adiada — aguardando aplicação |
| JV8-6 | textos contraditórios e env.example | `README.md:35,55-68`; `bia.py:20-24`; `jorge/agente/jorge.md:5`; `scripts/check-brave.sh:5`; `runner.py:115-119` | apontar tamanho para `cards.size_model`, corrigir papéis/timer, documentar variáveis somente no `.env.example` da Alice: Abacus Jorge, Brave script, OpenRouter Bia; varrer docs/agents e READMEs e atualizar apenas frases atuais contraditórias | `tools/alice-harness/{README.md,bia.py,.env.example}`, `tools/jorge/agente/jorge.md`, `docs/agents/{orquestracao.md,cartao-de-tarefa.md,travas.md}` conforme ocorrência | inspeção e teste textual quando possível; suíte permanece ≥238; não alterar notas históricas como se fossem instrução atual | baixo, documentação | doc/agente | adiada — aguardando aplicação |
| JV8-7 | quadro completo requer fonte de leva/filas | pedido §2; `feature.py:189-203`; `bia.py:62-74`; `runs/metrics.jsonl` | não fabricar filas/decisão de leva; especificar contrato de entrada autoritativo e atualização por todos os escritores, incluindo núcleo | futuros `tools/alice-harness/{quadro.py,alice.py,feature.py,bia.py}`, `docs/agents/quadro.md`; núcleo fora de escopo | futuro: alteração de etapa/filas/decisor reflete quadro, sem 0/0, sem quadro inteiro em prompt | alto, staleness/custos | correção/doc | adiada — aguardando Joel |

### JV8-1 — aceite explícito
- **Causa e comportamento atual:** `stage_review` só prepara arquivo e guarda `ready`; runner somente reconhece `done` em todos os estágios.
- **Comportamento pretendido / implementação mínima:** comando de aceite valida estado e dependências; altera exclusivamente etapa review via `Orchestrator.save()`, não por edição do Claude. Não relançar etapas já aceitas; o runner continua leitor.
- **Fora do escopo:** alterar estados existentes F02/F04 diretamente ou inventar aceite retroativo automático; mudança do núcleo separada abaixo.
- **Dependências e ordem:** JV8-2 antes, para que novas revisões não sejam aceitas com cobertura vazia. Aceite de revisões históricas sem tabela válida deve ser recusado se verificação exigir evidência; Joel/Claude reexecutam revisão.
- **Prova de regressão / negativos:** fixture sem rede grava ready, aceita, lê JSON; recusa audit não done, review pending, ID errado; `all` após done não volta a ready.
- **Compatibilidade:** novo subcomando `alice.py feature accept <F> --repo <path>`; antigo `feature <plano> <F>` preservado. Consumidores `runner.done_features` passam a enxergar `done`; configuração sem alteração. **Auditoria:** não aplicável. **Autorização:** pedido §1. **Custo/benefício:** risco de duplicação de Review menor; economia não quantificada. **Resultado observado:** pendente. **Status:** adiada — aguardando aplicação.

### JV8-2 — portão de cobertura na revisão
- **Causa e comportamento atual:** `next(..., '')` + `(sem tabela)` não muda exit.
- **Comportamento pretendido / implementação mínima:** checar cobertura no limite da revisão e falhar fechado, mantendo estado anterior em erro com mensagem `erro 17`; não reduzir outras verificações.
- **Fora:** mudança de check do produto; formatos alternativos não comprovados. **Dependências:** nenhuma. **Prova:** falso verde com checks sem tabela/`Unknown% (0/0)` falha antes e passa depois; tabela positiva permite `ready`; check 1 reprova. **Negativos:** 0/0 nunca verde; Bia não gasta rede; falha da ferramenta não aprova. **Compatibilidade:** CLI inalterada, comportamento de revisão inválida passa de exit 0 a 2; consumidor retro/estado recebe motivo; config nenhuma. **Auditoria:** não aplicável. **Autorização:** pedido §6. **Custo:** leitura e regex local; benefício de integridade não quantificável. **Resultado:** pendente. **Status:** adiada — aguardando aplicação.

### JV8-3 — modelo e origem declarados
- **Causa:** default em código e textos divergem; **pretendido:** default somente em YAML, origem explícita para cada execução de modelo, antes de rede. **Mínimo:** chave top-level `default`, função de resolução sem ler `.env` real no Review; harness existente continua a ler configuração em execução; mensagem em stderr. **Fora:** alterar modelos ou hardware. **Dependências:** nenhuma. **Prova/negativos:** dublês de ENV/process env, nome inválido falha antes de requisição; não anunciar em comando apenas informativo. **Compatibilidade:** env explícito vence default; novo default qwen35 intencional; consumidores CLI/metrics mantidos, config migra apenas se dependiam de gemma implícita. **Auditoria:** não aplicável; **autorização:** §3. **Custo:** chamada local YAML; economia não comprovada. **Resultado:** pendente; **status:** aguardando aplicação.

### JV8-4 — política obrigatória
- **Causa:** listas substituíveis, proteções ausentes, `allowedPaths` autoriza exceção. **Pretendido:** proteger de alteração não autorizada ambos os diretórios para cada agente e fonte única; padrão no default e repo apenas amplia, sem perder padrão. **Mínimo:** herança de padrões de `protectedWrite` e testes de autorização efetiva; não afirmar bloqueio absoluto se a semântica deliberada de `allowedPaths` o contradiz. **Fora:** bloquear cartões de harness autorizados, ampliar quota/permissões; proteger Bia requer comprovar seus caminhos de escrita. **Dependências:** nenhuma, condicionada à prova da Bia. **Prova/negativos:** sem e com override, cartão explicitamente liberado, tentativa de Bia de escrever caminho protegido, se existir; falha de configuração fecha. **Compatibilidade:** override deixa de poder remover proteções base (mudança intencional); CLI intacta, consumidores Guard e Bia precisam ser cobertos. **Auditoria:** trava — auditoria do Joel (`policy.default.yaml`, `policy.py`, `.agents/policy.yaml`). **Autorização:** §4; **custo/benefício:** integridade prioritária, risco de bloquear tarefa autorizada, não quantificado. **Resultado:** pendente; se não houver prova sem ampliar superfície, adiar esta evolução inteira em vez de proteção falsa.

### JV8-5 — custo Claude
- **Causa:** `-S` literal não encontra formatos distintos; comparação lexical não ordena offsets. **Pretendido/mínimo:** busca por ID em arquivos YAML versionados e normalização em UTC de filtro e transcript, sem estimar tokens faltantes. **Fora:** gravar transcript ou inventar horário para cartões sem commit. **Dependências:** nenhuma. **Prova/negativos:** fixture git parent/primeiro commit, ID ausente e offset de ambos lados; cobertura 0/0 não aplicável. **Compatibilidade:** `--since/--until` aceitam também ISO com offset e UTC permanece; custo estimado em unidades existentes, consumidores `cost` e `claude-usage`; config nenhuma. **Auditoria:** não aplicável; **autorização:** §6. **Custo:** I/O git do mesmo tipo que o anterior; correção de medição, economia não demonstrada. **Resultado:** pendente; **status:** aguardando aplicação.

### JV8-6 — textos e variáveis
- **Causa:** documentação retrata comportamento legado; **pretendido:** apenas uma definição atual, textos históricos rotulados histórico. **Mínimo:** correções pontuais; `NOTAS-ALICE.md` é nota de handoff do Claude Windows, não quadro autoritativo até JV8-7 resolvida. **Fora:** `.env` reais, `~/.claude`, produtos e fatos históricos. **Dependências:** JV8-3 para textos de perfil; JV8-1/2 para documentação de aceite e revisão. **Prova/negativos:** busca por frases legadas em documentos atuais, suíte, testes de tamanho já existentes; sem números paralelos nem promessa de portão inexistente. **Compatibilidade:** sem quebra de CLI/config; consumidor humano muda para modelo/aceite documentados. **Auditoria:** não aplicável; **autorização:** §5. **Custo:** pequeno; economia não medida. **Resultado:** pendente; **status:** aguardando aplicação.

### JV8-7 — contrato do quadro
- **Causa:** ainda não há fonte de verdade para quem decidiu a leva e cada fila; `runs/`, estado e quota não representam todos os campos. **Pretendido:** topo ≤~40 linhas, histórico separado, arquivo gerado e atualizado em cada transição, prompt Alice/Bia apenas seu item. **Mínimo agora:** não criar quadro estático que pareça atual; pedir decisão objetiva. **Fora:** núcleo e arquivos `docs/plano` proibidos. **Dependências:** Joel definir escritor/fonte da leva/filas; futura integração em orquestração e chamada de Bia. **Prova/negativos futuros:** filas vazias e erro de quota aparecem como desconhecido/bloqueio, nunca inventados; atualização idempotente e atômica, sem prompt com quadro inteiro. **Compatibilidade:** novo comando e campo de configuração requerem contrato; consumidores humano/Claude/Alice/Bia; custo de manutenção não estimável. **Auditoria:** não aplicável; **autorização:** §2 sem autorização para núcleo. **Resultado:** nenhuma escrita prevista agora; **status:** adiada — aguardando Joel.

## O que ficou para Joel decidir
| Decisão | Evolução | Motivo | Opções e recomendação | Bloqueia aplicação? |
|---|---|---|---|---|
| Fonte autoritativa da decisão da leva e filas + caminho de atualização no núcleo | JV8-7 | Pedido define campos mas não informa onde são registrados; núcleo não gravável | A) Joel fornece registro estruturado/CLI de leva e integração com runner (recomendado); B) quadro apenas estado conhecido e campos explícitos `?`, sem prometer filas N+1; não criar quadro falso | só JV8-7 |
| Gatilho automático ao fim **de cada leva** | JV8-1/JV8-7 | `runner.py:563-579` não conhece leva e `done_features` só detecta feature | Joel acrescenta evento de término da leva ao `auto_scope`/gatilho no núcleo após commit da leva; aceite fecha feature, mas não implica sozinho fim da leva | não bloqueia aceite |

Mudança exata de núcleo para Joel: em `tools/jorge/nucleo/runner.py`, preservar `done_features()` de `:506-517`, mas adicionar fonte de levas concluídas não revistas ao `auto_scope(:563-581)` com identidade estável, `seen` para evitar repetição e prioridade sobre retros/caixa; manter timer horário, trigger após entrega/commit, não durante execução. Joel especifica fonte estruturada da leva; não editar núcleo neste Review.

## Execução e suíte
| Momento | Evolução | Resultado | Executados | Falhas | Erros | Ignorados | Evidência |
|---|---|---|---:|---:|---:|---:|---|
| Referência | — | VERDE informado | 238 | 0 (inferido de VERDE) | 0 (inferido) | não informado | pedido do runner |
| Regressão antes da correção | — | não executada na análise | — | — | — | — | fase somente leitura |
| Após evolução | — | pendente | — | — | — | — | runner |
| Final — runner | — | pendente | — | — | — | — | runner |

- **Comando:** `python3 -m unittest discover -s tests`, em `tools/alice-harness`.
- **Anomalias de descoberta/contagem:** nenhuma informada; 0/0 não pode aprovar.
- **Tentativas/falhas intermediárias, desvios e evoluções revertidas:** nenhuma nesta fase.
- **Resultado transacional:** pendente; **commit:** reservado ao runner. Se não aplicado: runner registrará motivo e diff.

## Custo da execução do Jorge
| Medida | Valor | Fonte/observação |
|---|---:|---|
| Requisições à API, incluindo retries | pendente | runner |
| Tokens de entrada | pendente | runner |
| Tokens de saída | pendente | runner |
| Tokens totais | pendente | runner, sem dupla contagem |
| Entrada em cache | pendente | runner |
| Raciocínio | pendente | runner |
| Custo monetário | indisponível nesta fase | runner/provedor e tabela de preços |
| Chamadas de ferramentas / suítes | pendente / 0 executadas por Jorge | runner |
| Duração total | pendente | runner |

- **Cobertura da medição:** parcial, aguardando runner. Estimativas qualitativas separadas de dados medidos; nenhum custo/benefício monetário realizado alegado.
- **Consumo de Bia:** nenhum pelo Review; testes propostos sem rede.
- **Conclusão:** priorizar integridade e aceite verificáveis; adiar quadro sem fonte de filas para evitar custo e falsa atualidade.

---
## Verificação do runner
- Status: **aplicada**
- Base: `e7ffd877eb899831d5a8e2858e09d4730040f2fe`
- Suíte final: VERDE, 242 testes (referência 238)
- Arquivos alterados: .agents/policy.yaml, tools/alice-harness/alice.py, tools/alice-harness/feature.py, tools/alice-harness/models.yaml, tools/alice-harness/policy.default.yaml, tools/alice-harness/policy.py, tools/alice-harness/tests/test_feature_orchestrator.py, tools/alice-harness/tests/test_policy.py, tools/alice-harness/tests/test_profiles.py
- Rodadas de reparo usadas: 0
- Revertidos só estes (invariante): nenhum
- Travas (commit separado `Trava: sim`, auditoria do Joel): .agents/policy.yaml, tools/alice-harness/policy.default.yaml, tools/alice-harness/policy.py
- Problemas: nenhum

## Perguntas ao Joel (não bloquearam o Review)
- **JV8-7**: Para o quadro de levas: você prefere fornecer registro estruturado autoritativo (decisor, objetivo e filas N+1, atualizado pelo Claude/núcleo; recomendado) ou aceitar quadro parcial com campos desconhecidos e sem promessa de N+1 até haver esse registro? Para o gatilho ao fim da leva, qual evento estruturado persistido o núcleo deve observar depois do commit?

## Resumo do finish
Candidatas implementadas, ainda sujeitas à validação final do runner: JV8-1 (comando `feature accept <F>`, sem edição manual do estado, teste de aceite/recusa), JV8-2 (revisão bloqueia cobertura ausente/0/0/check vermelho, erro 17), JV8-3 (default do perfil em models.yaml, origem anunciada antes dos comandos de execução), JV8-4 PARCIAL (trava: default protege caminhos do harness/Jorge e override não remove `protectedWrite`/`denyRead`; teste das listas passou, MAS a proteção efetiva da Bia não foi provada, e caminhos explicitamente autorizados à Alice continuam liberados; não afirmar o requisito completo). JV8-5 não iniciado (cost/fusos); JV8-6 não concluído (documentação/env/docstring ainda pendentes); JV8-7 adiada — aguardando Joel especificar fonte autoritativa de leva/filas e evento do núcleo, pergunta registrada. Arquivos alterados: tools/alice-harness/{alice.py,feature.py,models.yaml,policy.default.yaml,policy.py,tests/test_feature_orchestrator.py,tests/test_profiles.py,tests/test_policy.py} e .agents/policy.yaml. Trava candidata: JV8-4 nos arquivos de política, auditoria do Joel necessária; a implementação está incompleta frente ao escopo Bia, e o runner deve decidir se pode validar/aplicar parcialmente ou reverter essa evolução. Suítes: referência 238 verde; regressões antes das correções 239 vermelho (aceite), 240 vermelho (cobertura), 241 vermelho (perfil), 242 vermelho (política, após correção de erro na própria fixture); após cada evolução 239, 240, 241 e 242 verdes, respectivamente. Nenhuma suíte final ou commit alegados. Desvios: JV8-1 foi implementada antes de JV8-2, embora o relatório prescrevesse ordem inversa; entrada `feature accept` é tratada pelo parser existente, não altera `docs/plano/**` neste Review. Texto de `policy.py` e `.agents/policy.yaml` ainda não garante bloqueio da Bia; reportar claramente a limitação. Não houve chamadas reais à Bia, nem alteração de produto/segredos/núcleo. Pedido de limite recebido, encerrando sem novas escritas.

## Custo da execução do Jorge (runner)

| Medida | Valor |
|---|---:|
| Modelo(s) | gpt-6-sol |
| Requisições | 59 (falhas re-tentadas: 0, sem usage: 0) |
| Tokens de entrada | 831154 |
| Entrada em cache | 4798186 |
| Tokens de saída | 12295 |
| Raciocínio (já na saída) | 0 |
| Créditos Abacus | 3570.31 |
| Passos análise / aplicação | 19 / 40 |
| Suítes rodadas | 9 |
| Início / fim | 2026-11-16T23:02:57-03:00 / 2026-11-16T23:06:44-03:00 |
