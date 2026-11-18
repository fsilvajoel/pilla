# harness-v5 — portões, medição e limite verificável da Bia

## Identificação
- **Versão:** harness-v5
- **Data:** 2026-11-16T17:22:01-03:00 (recebida)
- **Execução:** Review harness-v5; identificador adicional não fornecido.
- **Estado da versão:** proposta.
- **Escopo recebido:** reaplicar itens v2–v4 revertidos; prioridade cobertura 0/0, testes sob stub, uso/cota Bia, orçamento I–M; alinhar docs/agents ao sprint AGENTS.md §3.1. Análise 40 passos, aplicação 60, leitura ≤400 linhas, teto 3000 créditos; próximo uso de Alice/Bia exige suíte verde.
- **Fontes recebidas:** pedido; `tools/jorge/logs/harness-v{1,2,3,4}/relatorio.md`; `tools/alice-harness/runs/retro-20261116-{102615,102951}.md`; `AGENTS.md` §3.1; código e testes citados.
- **Base git:** `cabe1b185285d53be2e9475a3611d4fe1a70077e` (informada; branch `docs/mvp-planning`, worktree `jorge/harness-v5`).
- **Workspace inicial:** isolamento informado; limpeza não verificável com ferramentas disponíveis.
- **Modelo/provedor efetivamente utilizados:** indisponível nesta fase; `gpt-6-sol` informado, provedor efetivo não comprovado.
- **Autorizações de Joel:** ordem de aplicação autônoma, inclusive travas com teste; não concede escrita fora da lista nem autenticação de liberação extraordinária.
- **Suíte de referência:** VERDE, 231 testes (`python3 -m unittest discover -s tests`, `tools/alice-harness`), informada pelo runner nesta data; detalhes de erros/ignorados indisponíveis.

## Diagnóstico
### Fatos confirmados
- V2–V4 **não aplicadas**, apesar de suítes finais verdes (238, 239, 234): relatórios v2:201–214, v3:130–140 e v4:127–139 registram caminhos truncados `ools/...` ou `ocs/...`; v4 sugere ainda possível vazamento de teste fora da área, mas registro final aponta especificamente `ools/alice-harness/bia.py`. Não atribuir causa diferente sem prova do novo `run_tests`.
- `alice.py:192-200` aceita exit 0 com cobertura `Unknown% (0/0)`; `bia.py:128-129` distribui o resultado aos portões. `feature.py:305-339` roda os dois lotes de testes no worktree, não no stub; `with_stub:382-395` altera índice via checkout e não restaura arquivo ausente. A retro `102951:26-33` mostra mensagem de quota da etapa tests depois de `done`; `feature.py:195-199` retém `message/red`.
- `bia.py:88-113` faz até 3 tentativas por chat, contando apenas resposta com `choices`; `feature.py:213-233` conta um chat antes da rede e perde deltas quando ocorre exceção. `cards.py:393,443-445` aceita `biaBudget` 6. `feature.py:183-224` confia em plano e estado editáveis; `bia.py:344-357,448-456,485-501` e `alice.py:1239-1243` chegam à Bia fora da feature. Não há autoridade não falsificável para ledger/liberação exclusiva do Joel na lista de escrita.
- `AGENTS.md:38-52` define sprint de seis etapas e Jorge fora da entrega; `docs/agents/orquestracao.md:28-38,80`, `cartao-de-tarefa.md:98-115` e `travas.md:109-110` ainda descrevem fluxo antigo por feature e orçamento 2–6; `roles/planner.md:13` replica 2–6.
- `metricas(metrics)`: 28 runs, 17 done (60,7%), média 1,96 tentativas e 201,2 s; `metricas(evolution)` não mede economia de correções revertidas. Custos históricos v2/v3/v4 informados: 1837,88/2852,93/2571,93 créditos Abacus, não custo desta execução.

### Causas e hipóteses
- **Confirmadas:** falta de normalização do check de cobertura; etapa tests usa implementação prévia; contadores por sucesso/chat em vez de tentativas; diagnósticos persistem após `finish`; limite de configuração 6; docs sem sprint novo.
- **Não confirmadas:** formato exaustivo do vitest, custo de chamadas poupadas, payload de quota/usage real em erro, mecanismo autoritativo e migração dos planos legados, causa adicional de vazamento do v4. `0/0` de tokens nas retros da Alice não prova perda de tokens da Bia.

### Justificativa econômica
- Falso verde e contagem de rede subestimada justificam regressões pequenas antes das próximas features; fixture git temporária é necessária para evitar destruir trabalho em progresso. Teto 3 limita exposição, mas não equivale a ledger I–M e pode bloquear planos 4–6; custo dessa migração não estimado. Correção de estado e documentação reduz diagnóstico enganoso com custo baixo. Não prometer economia realizada; limitar a superfície para respeitar 3000 créditos e ≥231 testes.

## Evoluções
| ID | Problema | Evidência | Mudança | Arquivos | Teste que prova | Risco | Tipo | Status |
|---|---|---|---|---|---|---|---|---|
| JV5-1 | cobertura global 0/0 verde | `alice.py:192-200`; v2:19-22 | check de cobertura com total global vazio retorna não zero | `tools/alice-harness/alice.py`, `tools/alice-harness/tests/test_test_guardrails.py` | mock: `All files | Unknown% (0/0)` exit 0 falha; total positivo e comando comum passam | médio, formato de saída | correção | adiada — aguardando aplicação |
| JV5-2 | testes da Bia executados contra implementação anterior | `feature.py:305-339,382-395` | contexto só dos checks da etapa tests com HEAD stub; snapshot/restauração do worktree sem tocar índice; erro fechado | `tools/alice-harness/feature.py`, `tools/alice-harness/tests/test_feature_orchestrator.py` | git temporário: impl prévia não gera reparo; staged e modo preservados; falha de git não aprova | médio/alto, manipulação transitória | correção | adiada — aguardando aplicação |
| JV5-3 | tentativas/tokens Bia omitidos | `bia.py:88-113`; `feature.py:213-233` | contar cada tentativa na fronteira da rede, uso quando recebido sem `choices`, delta em erro na feature | `tools/alice-harness/bia.py`, `tools/alice-harness/feature.py`, `tools/alice-harness/tests/test_test_guardrails.py`, `tools/alice-harness/tests/test_feature_orchestrator.py` | retries/erro com usage e sem usage; quota não é completions; feature preserva deltas | médio, mudança semântica de medição | correção (se linha de cota tocada, trava) | adiada — aguardando aplicação |
| JV5-4 | teto nominal J ainda permite 4–6 | `cards.py:393,443-445`, `tests/test_features.py:24` | validar 2..3 e atualizar fixtures/instrução planner | `tools/alice-harness/cards.py`, `tools/alice-harness/tests/test_features.py`, `tools/alice-harness/tests/test_feature_orchestrator.py`, `tools/alice-harness/roles/planner.md` | 3 aceito, 4/6 recusados; feature rejeita antes da Bia | alto, planos legados | **trava** | adiada — aguardando aplicação |
| JV5-5 | erro velho em etapa done | `feature.py:195-199`; retro `102951:26-33` | remover somente `message/red` anteriores em `finish` | `tools/alice-harness/feature.py`, `tools/alice-harness/tests/test_feature_orchestrator.py` | erro→done limpa; erro novo e contadores mantidos | baixo | correção | adiada — aguardando aplicação |
| JV5-6 | docs/agents divergem do sprint §3.1 e teto | `AGENTS.md:38-52`; `orquestracao.md:28-38,80`; `cartao-de-tarefa.md:98-115`; `travas.md:109-110` | atualizar sequência de refinamento, teste revisado antes da Alice, revisão/entrega/retro Jorge; alinhar teto somente se JV5-4 passar | `docs/agents/{orquestracao,cartao-de-tarefa,travas}.md` | inspeção das seis etapas e `run_tests`; teste de coerência documental se simples | médio, contrato descrito versus implementação | doc | adiada — aguardando aplicação |
| JV5-7 | I/K/L/M requerem ledger, parada/notificação, liberação não forjáveis | `feature.py:183-224`, `bia.py:88-113`; v4:76-81 | **não** simular autoridade no worktree; integração futura somente com núcleo/serviço controlado pelo Joel | nenhum agora; futuro mecanismo externo fora da lista, integração em `tools/alice-harness/{bia,feature}.py` | futuro: falsificação do plano/estado/liberação não concede rede; reserva atômica por retry, persistência falha bloqueia | alto, falsa segurança | trava futura | adiada — impedimento de autoridade/invariante |
| JV5-8 | resume por ID, quota bruta, Abacus, commits intermediários e gatilho duplicado | v2:109-152; v4:83-85; `bia.py:77-85`, `alice.py:1352-1354` | sem alteração sem evidência; commits/gatilho já contrariariam fluxo vigente | nenhum | reprodução de IDs ambíguos/payload real antes de proposta | médio, corrida/compatibilidade | correção | adiada (ID/quota/env, falta prova); recusada (commits/gatilho) |

### JV5-1 — cobertura mensurável
- **Causa e comportamento atual:** `run_cmd` repassa exit 0 sem inspecionar total global. **Pretendido:** `0/0` global comprovado jamais verde no consumidor de checks. **Mínimo:** detecção estreita de `All files | Unknown% (0/0)` somente em comando `--coverage`; erro legível. **Fora:** vitest/produto e inferir cobertura positiva de saída sem tabela. **Dependência:** nenhuma, aplicar primeiro. **Prova:** mock de subprocess, falha antes/passe depois; negativo cobertura não vazia, 0/0 não global ou comando sem cobertura, exit não zero. **Compatibilidade:** CLI/config sem mudança, Bia/feature/Run recebem falha nova; varredura de saída pequena. **Auditoria:** não aplicável. **Autorização:** pedido v5. **Custo/benefício:** alta integridade, economia não mensurável. **Resultado:** pendente. **Motivo:** aguarda aplicação.

### JV5-2 — stub transacional da etapa tests
- **Causa:** checks das linhas 321/331 veem worktree; `with_stub` não é seguro para reutilizar. **Pretendido:** ambos os lotes veem HEAD sem afetar staged/worktree depois, inclusive exceção. **Mínimo:** contexto isolado para etapa tests, ler bytes do HEAD e snapshot de existência/bytes/mode dos paths implement, restaurar em `finally`; abortar antes de aprovar se preparação falha. **Fora:** complementar `with_stub`, produto, estado real de plano. **Dependência:** depois JV5-1. **Prova:** fixture git em `TemporaryDirectory` com HEAD stub, staged diferente, impl prévia, arquivo novo/sem HEAD e git falho; primeiro check não chama reparo, `bad` chama reparo contra stub, índice e worktree idênticos. **Negativos:** exceção/falha de git nunca `done`; nenhuma fixture toca repo real, `docs/plano/**` ou `runs/**` reais. **Compatibilidade:** CLI/config iguais, orquestração muda para TDD correto; overhead I/O git, economia hipotética. **Auditoria:** não aplicável. **Autorização:** v5. **Custo/benefício:** evita reparo falso potencial; custo pequeno se restauração comprovada. **Resultado:** pendente. **Motivo:** aguarda prova/aplicação.

### JV5-3 — medição sem inventar uso
- **Causa:** contador na resposta com choices e no chat da feature, tokens perdidos em exceção. **Pretendido:** tentativas reais de completions e usage informado, inclusive erro; ausência de usage não é zero medido de custo. **Mínimo:** incremento junto à tentativa de `urlopen`, agregação de usage validamente recebido sem choices, coleta do delta em `finally` em `ask`; se necessário contagem física por `ops.usage()` no lugar de chats, com dublês atualizados e preservação do bloqueio pré-chamada. **Fora:** tokens inferidos em HTTP sem usage, alteração de quota do provedor, ledger autoritativo. **Dependência:** depois JV5-2 e antes JV5-4. **Prova:** mocks de 2 retries sem sleep e respostas com/sem usage; erro na feature mantém delta; negativo quota/erro sem usage não inventa tokens, sem double count no plan-run. **Compatibilidade:** CLI/config iguais; `biaRequests` passa a representar tentativas de completions para consumidores de feature/retro/plan-run; explicitar eventual contagem de tentativas sem resposta, não total de cota OpenRouter. Overhead constante; impacto financeiro não mensurado. **Auditoria:** contador comum não trava; se tocar linhas de cota/reserva, classificar e testar como trava. **Autorização:** v5. **Resultado:** pendente. **Motivo:** aguarda aplicação.

### JV5-4 — teto três (J, não I–M inteiros)
- **Causa:** validador permite 6; plano/estado editáveis continuam bypass de orçamento efetivo. **Pretendido:** validador recusa 4–6 antes de gastar Bia, preserva 2/3; não declarar proteção de ledger. **Mínimo:** limite superior 3 em `cards.py`; testes de fronteira, fixtures de happy path e planner sincronizados; não alterar `docs/plano/**`. **Fora:** migração real de planos, ledger/liberação e rotas diretas de Bia. **Dependência:** após JV5-3; docs JV5-6 dependem do resultado. **Prova:** `feature_problems` 3 válido/4 e 6 inválidos; `cmd_feature` 4 recusa sem chamadas; negativo 1 e string inválidos. **Compatibilidade:** CLI igual; quebra da configuração `biaBudget` 4–6 e bloqueia features legadas até migração externa; consumidores do plano devem corrigir fora deste Review. **Auditoria:** **trava — auditoria do Joel**, commit separado pelo runner. **Autorização:** Joel v5 autoriza travas testadas, não migração de produto. **Custo/benefício:** limita configuração declarada; custo de migração não estimável. **Resultado:** pendente. **Motivo:** aguarda aplicação, não equivale à autoridade independente.

### JV5-5 — estado sem diagnóstico vencido
- **Causa:** `dict.update` preserva `message/red`. **Pretendido:** etapa `done` relata somente resultado atual. **Mínimo:** descartar campos efêmeros antes de atualizar, preservar segundos e contadores. **Fora:** estados reais legados. **Dependência:** após JV5-2/3 por arquivo compartilhado. **Prova:** erro→done limpa mensagem/red; novo erro os conserva, segundos/requisições persistem. **Negativo:** 0/0 já barrado em JV5-1. **Compatibilidade:** CLI/config iguais, consumidores de estado/retro não recebem erro vencido; custo insignificante. **Auditoria:** não aplicável. **Autorização:** v5. **Resultado:** pendente. **Motivo:** aguarda aplicação.

### JV5-6 — documentação do sprint
- **Causa:** orquestração descreve fluxo anterior (testes e implementação no mesmo `all`) enquanto §3.1 exige testes prontos/revisados antes de Desenvolvimento; documentos citam 2–6. **Pretendido:** registrar seis etapas e fronteira de início da Alice sem afirmar que `all` já impõe pausa/revisão externa; esclarecer limitação operacional se ainda não mecanizada. **Mínimo:** atualizar somente seções pertinentes em `orquestracao.md`, `cartao-de-tarefa.md`, `travas.md`; teto 2–3 se JV5-4 aplicada. **Fora:** editar `AGENTS.md`, produto, inventar gate de aprovação não implementado. **Dependência:** depois JV5-4/5. **Prova:** revisão textual comparando §3.1 e opções CLI reais, suíte verde após edição; negativo `all` não chamado de proteção que não existe. **Compatibilidade:** CLI/config iguais; leitores Claude/Bia/Alice recebem sequência atualizada; risco de desalinhamento mitigado por descrição honesta; custo pequeno, economia não medida. **Auditoria:** não aplicável. **Autorização:** v5 explícita. **Resultado:** pendente. **Motivo:** aguarda aplicação.

### JV5-7 — limites de I/K/L/M
- **Causa:** estado/plano local manipuláveis, retries não reservados atomicamente e liberação editável não autentica Joel. **Pretendido:** ledger exclusivo por tentativa, parada/notificação e liberação autenticada por Joel. **Mínimo agora:** nenhuma falsa trava; JV5-3 fornece medição e JV5-4 apenas J. **Fora:** `.env` real, `docs/plano/**`, núcleo e serviço externo; não declarar I–M completos. **Dependência:** autoridade externa e migração pelos responsáveis, não impede JV5-1..6. **Prova futura:** adulterar estado/plan/liberação não amplia chamadas, retry debita antes da rede, falha na persistência bloqueia, notificação idempotente, liberação válida escopada/expirada; caso negativo de rota direta Bia e plan-run. **Compatibilidade:** nenhuma agora; futura API/config/consumidores requerem projeto e migração; custo desconhecido, risco de falsa segurança maior que benefício da implementação local. **Auditoria:** futura trava — Joel; nenhuma aplicada neste item. **Autorização:** v5 não amplia escrita. **Resultado:** sem alteração proposta agora. **Motivo:** adiada por autoridade externa/invariante, não por espera de conversa.

### JV5-8 — residual sem prova
- **Causa:** `resume` só recebe caminho e não existe regra segura para escolher ID duplicado; quota/usage real ausente; Bia lê OpenRouter, não Abacus; commit pertence ao Claude e timer já existe. **Pretendido:** não inserir automação especulativa. **Mínimo:** nenhum. **Fora:** produto/API reais e mudanças na entrega em andamento. **Dependência:** evidências adicionais futuras; não bloqueia outros IDs. **Prova futura:** ID único/duplicado/inexistente e caminho legado; payload real de quota e erro. **Negativos:** não escolher ID ambíguo, não atribuir Abacus à Bia, não duplicar Review. **Compatibilidade:** CLI/config/consumidores intactos; evita custo especulativo não mensurado. **Auditoria:** não aplicável. **Autorização:** triagem autônoma. **Resultado:** nenhuma escrita. **Motivo:** ID/quota/env adiadas por falta de prova; commits/gatilho recusados por corrida/fluxo.

## O que ficou para Joel decidir
| Decisão | Evolução | Motivo | Opções e recomendação | Bloqueia aplicação? |
|---|---|---|---|---|
| Planejamento futuro de autoridade e migração fora da escrita de Jorge | JV5-7/JV5-4 | núcleo/serviço e `docs/plano/**` proibidos; planos existentes podem ter 4–6 | autoridade exclusiva do Joel com reserva atômica, ou núcleo sob Joel; recomendar migração separada e não afirmar I–M completos | somente futuro I/K/L/M e execução de planos legados; não bloqueia correções v5 |

Nenhuma pergunta assíncrona registrada: a ordem autônoma não modifica invariantes; relatório não concede acesso ao núcleo ou aos planos.

## Execução e suíte
| Momento | Evolução | Resultado | Executados | Falhas | Erros | Ignorados | Evidência |
|---|---|---|---:|---:|---:|---:|---|
| Referência | — | VERDE informado | 231 | não informado | não informado | não informado | pedido do runner v5 |
| Regressão antes, se viável | JV5-1..5 | aguardando aplicação | — | — | — | — | — |
| Após cada evolução | JV5-1..6 | aguardando `run_tests()` | — | — | — | — | — |
| Final — runner | — | aguardando runner | — | — | — | — | — |
- **Comando:** `python3 -m unittest discover -s tests` em `tools/alice-harness`.
- **Anomalias:** nenhuma aferida nesta análise; 0 testes não é verde, final ≥231. `run_tests` do núcleo v5 deve flagrar `teste_vaza`; todas fixtures propostas usam `TemporaryDirectory` e injeção de caminhos.
- **Tentativas/falhas:** nenhuma nesta análise; v2–v4 revertidas mesmo com suíte verde por invariante. Se v5 detectar escrita fora da área, não contornar.
- **Desvios:** nenhum ainda. **Resultado transacional:** pendente. **Commit:** exclusivamente runner. **Se não aplicado:** runner registra impedimento/diff. **Evoluções revertidas:** nenhuma nesta fase.

## Custo da execução do Jorge
Dados da API/runner ainda indisponíveis para esta fase; não confundir com os históricos v2–v4.
| Medida | Valor | Fonte/observação |
|---|---:|---|
| Requisições à API, incluindo retries | indisponível | runner |
| Tokens de entrada | indisponível | usage |
| Tokens de saída | indisponível | usage |
| Tokens totais | indisponível | runner, sem dupla contagem |
| Entrada em cache | indisponível | usage |
| Raciocínio | indisponível | runner informa se incluído na saída |
| Custo monetário | indisponível | runner/API/preços |
| Chamadas de ferramentas / suítes | runner / 0 nesta análise | runner |
| Duração total | indisponível | runner |
- **Cobertura da medição:** parcial até fechamento do runner. **Estimativas:** somente qualitativas, sem ganhos monetários realizados. **Consumo de Bia:** nenhum pelo Review (testes planejados usam mocks). **Conclusão:** priorizar integridade dos portões e medição antes da próxima feature; ganhos financeiros não medidos e segurança I–M não prometida.


---
## Verificação do runner
- Status: **nao_aplicada**
- Base: `cabe1b185285d53be2e9475a3611d4fe1a70077e`
- Suíte final: VERDE, 238 testes (referência 231)
- Arquivos alterados: ools/alice-harness/alice.py, tools/alice-harness/bia.py, tools/alice-harness/cards.py, tools/alice-harness/feature.py, tools/alice-harness/roles/planner.md, tools/alice-harness/tests/test_feature_orchestrator.py, tools/alice-harness/tests/test_features.py, tools/alice-harness/tests/test_test_guardrails.py
- Rodadas de reparo usadas: 2
- Revertidos só estes (invariante): ools/alice-harness/alice.py
- Travas (commit separado `Trava: sim`, auditoria do Joel): nenhuma
- Problemas: escrita proibida: ools/alice-harness/alice.py (permitido: tools/alice-harness/**, docs/agents/**, .agents/policy.yaml, tools/jorge/agente/**; nunca segredos, núcleo, estado, apps, packages)

## Resumo do finish
Reparo 2/2: verificação final novamente reprovada por caminho `ools/alice-harness/alice.py`, apesar de VERDE 238 testes. Como o runner recusou a escrita pelo invariante e não há correção autorizada para o caminho truncado que ele reporta, não tentei contornar nem fiz novas escritas; não houve `run_tests` após reparo inexistente. Correção JV5-1 e demais alterações candidatas não podem ser declaradas aplicadas; runner deve reverter este Review e registrar o impedimento. JV5-6 continuou não concluída; JV5-7/8 adiadas/recusadas conforme relatório. Nenhum commit alegado; trava de teto 3 não confirmada como aplicada. Duas rodadas finais reprovaram pelo mesmo caminho, embora as duas suítes do runner reportem 238 testes OK; nenhuma pergunta ao Joel.

## Custo da execução do Jorge (runner)

| Medida | Valor |
|---|---:|
| Modelo(s) | gpt-6-sol |
| Requisições | 52 (falhas re-tentadas: 0, sem usage: 0) |
| Tokens de entrada | 868368 |
| Entrada em cache | 4750888 |
| Tokens de saída | 12625 |
| Raciocínio (já na saída) | 0 |
| Créditos Abacus | 3725.74 |
| Passos análise / aplicação | 7 / 45 |
| Suítes rodadas | 11 |
| Início / fim | 2026-11-16T17:22:01-03:00 / 2026-11-16T17:25:45-03:00 |
