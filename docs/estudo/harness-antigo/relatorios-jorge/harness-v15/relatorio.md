# harness-v15 — revalidar testes sem rebaixar aprovação e seguir cartões atuais

## Identificação

- **Versão:** harness-v15
- **Data:** 2026-11-17T01:07:06-03:00 (informada; relógio não aferido)
- **Execução:** Review harness-v15; ID adicional não informado.
- **Estado da versão:** proposta.
- **Escopo recebido:** `recheck-tests` rebaixa `tests: done` para `error` depois do refatiamento E6-F01; conferir se `implement` usa cartões atuais. Análise ≤40 passos, aplicação ≤60, leitura ≤400 linhas, teto informado 3000 créditos.
- **Fontes recebidas:** anotação 2026-11-17T01:07:06-03:00; `tools/jorge/logs/harness-v14/relatorio.md` (runner confirmou 273 testes, sem pendências executáveis), v13 (dependências interfeature) e v12 (origem do recheck); `docs/plano/E6.yaml`; `docs/agents/orquestracao.md`; nenhuma retro indicada. Estado real de E6-F01 não consta deste worktree (`docs/plano/E6-F01/` contém apenas `plano.md`).
- **Base git:** `26ffb72d535d1d70cabca9e7bc851b377196e286` (`docs/mvp-planning`), worktree `jorge/harness-v15` informado.
- **Workspace inicial:** worktree isolado informado; limpeza não aferível pelas ferramentas de leitura.
- **Modelo/provedor efetivamente utilizados:** `gpt-6-sol` informado; metadados efetivos da API não disponíveis.
- **Autorizações de Joel:** nenhuma adicional; não alterar orçamento, cota, trava nem `docs/plano/**`.
- **Suíte de referência:** VERDE, 273 testes, `python3 -m unittest discover -s tests` no harness, informada pelo runner; falhas/erros zero inferidos; ignorados não informados.

## Diagnóstico

### Fatos confirmados

- `feature.py:412-416` só aceita `tests: escalated`, mas retorna `finish('tests','error',...)` para qualquer outro status; `finish` persiste a mudança (`:198-204`). Logo `done` vira `error` antes de consultar arquivos/checks. Em seguida `stage_implement` pula se `tests` não está `done` (`:451-455`). `stage_tests` restaura testes anteriores e chama Bia (`:363-385`); repetir `--stage tests` não é recuperação segura. Anotação relata E6-F01, commit 2338087, mas a gravação específica não pode ser inspecionada neste worktree.
- `recheck-tests` já confere arquivos/cenários, executa todos os checks contra stub e atualiza SHAs apenas após verde (`feature.py:417-439`); caso vermelho escala e erro de stub/arquivo falha fechado. Teste `test_feature_orchestrator.py:294-319` cobre somente `escalated`, inclusive casos inválidos. CLI/documentação `README.md:9` e `docs/agents/orquestracao.md:50-59` dizem explicitamente `escalated`.
- `load_feature` constrói membros do plano recebido em cada inicialização (`feature.py:155-162,180-188`); `stage_implement` cria mapa e lista para `plan_run` de `self.f.impls`, e substitui `implement.cards` pelos resultados desta execução (`:451-465`). Não usa `implement.cards` antigo para escolher IDs em `--stage implement`. Já `run('all')` pula qualquer etapa marcada `done` sem confrontar a lista antiga com o plano atual (`:666-682`); `audit`/`accept` checam status da implementação, não completude dos cartões atuais (`:516-519,649-659,702-726`). `stage_review` exibe o mapa antigo sem bloquear (`:629-634`). Há bypass comprovável do fluxo `all` após refatiamento se o estado antigo disser `implement: done`, embora não haja estado E6-F01 observável nesta base.
- `docs/plano/E6.yaml:54-133,353-364` agora lista E6-T02 e E6-T07 separadamente e inclui E6-T07 em F01; a anotação diz que estado antigo guardava T02/T04 failed. `metricas(evolution)` registra cinco runs E6 não done, média 27 chamadas e 466.281 tokens de entrada; `metricas(metrics)` registra 36 runs, 18 done e 21.119.195 tokens de entrada de Alice. Esses números são históricos, não medem custo deste Review nem comprovam sucesso futuro.

### Causas e hipóteses

- **Confirmada:** precondição excessiva e `finish` mutante ao recusá-la; retomada por `all` confia em status sem vínculo com cartões da versão atual do plano. Chamada explícita `--stage implement` já roda os IDs atuais.
- **Não confirmada:** conteúdo exato do `estado.json` de E6-F01 e se há cenários/testes disponíveis e checks verdes neste checkout; ausência impede declarar que recheck real seria aprovado. Não presumir que testes aprovados permanecem adequados após qualquer mudança de cenários.

### Justificativa econômica

- Um bloqueio observado após revisão/commit de testes induz reexecução desnecessária da Bia e risco de sobrescrever arquivos; eliminar esse caminho por checagem local é pequeno e diretamente verificável. O risco do `all` é mais amplo que o incidente explícito, mas nasce do mesmo refatiamento e pode ser reproduzido com fixture sem tocar produto; uma comparação de IDs evita pular implementação atual. Checks locais e suíte custam tempo; economia em requisições/tokens é potencial, não realizada nem quantificável com as métricas atuais.

## Evoluções

| ID | Problema | Evidência — arquivo:linha na base ou retro | Mudança | Arquivos | Teste que prova | Risco | Tipo | Status |
|---|---|---|---|---|---|---|---|---|
| JV15-1 | Recheck de `done` destrói aprovação e bloqueia implement | `feature.py:412-455`; anotação E6-F01; `test_feature_orchestrator.py:294-319` | Aceitar rechecagem de `done`, `error` e `escalated` com os mesmos portões de arquivos, cenários, stub, checks e SHA; para estado sem teste produzido ou precondição inválida recusar sem rebaixar `done` | `tools/alice-harness/feature.py`, `tools/alice-harness/tests/test_feature_orchestrator.py`, `tools/alice-harness/README.md`, `docs/agents/orquestracao.md` | `done` rechecado verde atualiza SHA e permite implement sem Bia; `error` com testes presentes revalida; faltante/vermelho/erro stub/0/0 nunca aprova, e recusa por status não destrói done | médio: recheck de estado antigo pode validar teste indevido; manter exigência de cenários atuais e checks | correção | adiada — aguardando aplicação |
| JV15-2 | `all` pode pular implementação após plano ganhar cartão novo | `feature.py:155-162,451-465,666-682`; `E6.yaml:54-133,353-364` | Só considerar `implement: done (já feito)` quando mapa `implement.cards` corresponder exatamente aos IDs implement atuais e cada status for done; se não, executar etapa implement (sujeita a `tests: done`) e substituir mapa com resultados; manter `--stage implement` atual | `tools/alice-harness/feature.py`, `tools/alice-harness/tests/test_feature_orchestrator.py`, `docs/agents/orquestracao.md` | fixture plano acrescido de T07 com estado antigo `implement: done/cards={T02:done}`: `all` chama `plan_run` com IDs atuais; mapa completo pula; estado com cartão failed não pula; tests não done não chama Alice | médio: pode repetir cartão anterior em `all`; comportamento já é o de `--stage implement`, sem substituir `plan_run` nem editar estado real | correção | adiada — aguardando aplicação |

### JV15-1 — recheck sem consumir Bia nem destruir `done`

- **Causa e comportamento atual:** requisito `escalated` é anterior aos checks; `finish` grava `error` mesmo quando estava `done`, e `implement` passa a ser skipped. `error` com teste recuperável também fica sem caminho local.
- **Comportamento pretendido:** chamada explícita revalida `done/error/escalated` só se os arquivos/cenários do plano atual existirem; em verde atualiza SHAs, `expectRed`, documento e `tests: done` sem Bia; nenhum estado sem evidência pode virar done por mera precondição.
- **Implementação mínima:** alterar precondição de status e recusar status não elegível sem chamar `finish` para estado `done`; manter fluxo existente de checks/falhas. Se `done` tiver arquivos/cenários inválidos, falhar fechado com diagnóstico sem dar verde nem enviar Alice até validação válida; determinar no teste o status coerente com essa falha, sem preservar `done` em check realmente vermelho. Não chamar `stage_tests` nem alterar critérios.
- **Fora do escopo:** reconstruir manualmente E6-F01, criar testes/cenários novos, editar `docs/plano/**` ou garantir aprovação editorial depois de refatiamento.
- **Dependências e ordem:** nenhuma; aplicar antes de JV15-2.
- **Prova de regressão:** iniciar `tests: done` via fixture, alterar teste, recheck antes da correção produz `error`, depois `done`, SHA novo, checks sob stub, zero novas chamadas Bia, `implement` recebe SHA novo; `error` com cenários e arquivos válidos também conclui sem Bia.
- **Casos negativos/limites:** `pending`, arquivo/cenário ausente, erro de leitura/stub e check vermelho não dão `done`; `0/0` de cobertura não pode dar verde (preservar portão existente e simular saída inválida se o plano declarar cobertura). Recusa de status inválido não degrada `done`; falha real de revalidação deve ser visível e bloquear implementação.
- **Compatibilidade:** CLI mantém `--stage recheck-tests`, sem novo argumento; configuração/limites de tamanho/orçamentos inalterados. Consumidores Claude/Alice passam a poder revalidar `done`/`error`; documentação descreverá o novo alcance; testes não são reescritos, Bia não chamada.
- **Auditoria:** não aplicável; não é trava. **Autorização:** pedido recebido de correção de recheck.
- **Custo/benefício esperado:** checks locais repetidos têm custo de tempo desconhecido; evita possível chamada adicional da Bia e sobrescrita, sem economia medida.
- **Resultado observado:** aguardando aplicação e suítes. **Motivo do status:** adiada — aguardando aplicação.

### JV15-2 — retomada `all` alinhada ao plano atual

- **Causa e comportamento atual:** `--stage implement` monta `cards` do plano atual e não lê os antigos; `--stage all` pula implementação marcada `done` mesmo se ganhou cartão ou mapa antigo estiver incompleto. Estado real E6-F01 ausente nesta base: só o segundo mecanismo é reprodução por fixture.
- **Comportamento pretendido:** `all` não anuncia `implement: done (já feito)` se algum cartão implement atual não tiver resultado done ou se sobrar ID retirado no mapa; quando executar, plano atual determina IDs e o mapa persistido. Testes precisam permanecer done para rodar.
- **Implementação mínima:** condicionar somente o skip de `implement` em `run` à comparação exata entre IDs atuais e `implement.cards` todos done; manter estágios/CLI e `plan_run`. Não confiar em mapa antigo para selecionar cartões. Se detectar plano novo mas `tests` não estiver done, fluxo explícito deve parar antes da Alice; não autorizar Bia automaticamente.
- **Fora do escopo:** migrar/editar estado real de F01, adaptar automaticamente cenários editoriais, reexecutar auditoria/aceite de entrega histórica já finalizada. Se surgir bypass de `accept` independente do `all` com evidência de uso, registrar separadamente, não refatorar incidentalmente.
- **Dependências e ordem:** após JV15-1 para recuperar tests done no cenário do incidente; mudança em `all` tecnicamente independente.
- **Prova de regressão:** fixture com `implement:done` de T02/T04 antigos e plano contendo T02/T07/T04: antes `all` pula, depois passa lista atual ao `plan_run` e salva mapa atual; mapa completo e all done continua sem execução; mapa incompleto/failed não é verde, `tests:error` impede chamada.
- **Casos negativos/limites:** nenhum sucesso inferido de `0/0`; checks de execução permanecem em `plan_run`, testes sem aprovação nunca iniciam Alice; `audit` não ganha permissão por mapa parcial.
- **Compatibilidade:** CLI/configuração iguais; consumidores de `all` passam a ver nova execução quando o plano mudar; `--stage implement` não muda. Custo potencial de reexecutar cartões por `plan_run` (nenhuma otimização por status parcial sem prova); evita falso progresso; não quantificado.
- **Auditoria:** não aplicável; portão/orquestração comum. **Autorização:** segundo pedido recebido, confirmado pelo caminho de código.
- **Custo/benefício esperado:** comparação local barata evita estado verde falso e possível retrabalho de revisão; custo Alice só se a implementação precisar ser refeita; sem economia medida.
- **Resultado observado:** aguardando aplicação e suítes. **Motivo do status:** adiada — aguardando aplicação.

## O que ficou para Joel decidir

| Decisão | Evolução | Motivo | Opções e recomendação | Bloqueia aplicação? |
|---|---|---|---|---|
| Nenhuma para o escopo executável | — | portões e orquestração alteráveis sem afrouxar trava | conservar checks, cota e aprovação editorial | Não |

`docs/plano/E6-F01/estado.json`/arquivos de produto não podem ser criados ou editados pelo Jorge; a recuperação concreta cabe à entrega fora deste Review. Este relatório não concede essa permissão.

## Execução e suíte

| Momento | Evolução | Resultado | Executados | Falhas | Erros | Ignorados | Evidência |
|---|---|---|---:|---:|---:|---:|---|
| Referência | — | VERDE informado | 273 | 0 inferido | 0 inferido | não informado | pedido runner |
| Regressão antes da correção | JV15-1/2 | não executada: análise só leitura | — | — | — | — | análise |
| Após evolução | JV15-1/2 | pendente | — | — | — | — | aplicação |
| Final — runner | — | pendente | — | — | — | — | runner |

- **Comando:** `python3 -m unittest discover -s tests`, no diretório do harness.
- **Anomalias de descoberta/contagem:** nenhuma informada; zero testes não é verde.
- **Tentativas e falhas intermediárias:** nenhuma suíte executada nesta fase.
- **Desvios do relatório inicial:** nenhum até aqui.
- **Resultado transacional:** pendente do runner. **Commit:** pendente do runner.
- **Se não aplicado:** registrar motivo e diff preservado pelo runner. **Evoluções revertidas:** nenhuma nesta análise.

## Custo da execução do Jorge

Dados de uso da API/runner indisponíveis nesta análise; métricas históricas de Alice não representam custo deste Review.

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

- **Cobertura da medição:** parcial, aguardando runner.
- **Estimativas separadas dos valores medidos:** apenas efeitos qualitativos; 466.281 tokens são média histórica de Alice nas execuções E6, não consumo do Jorge.
- **Consumo de Bia:** nenhum pelo Review.
- **Conclusão:** a correção pode poupar repetição de testes e evitar falso progresso de implementação; economia efetiva depende de novas medições.

---
## Verificação do runner
- Status: **aplicada**
- Base: `26ffb72d535d1d70cabca9e7bc851b377196e286`
- Suíte final: VERDE, 278 testes (referência 273)
- Arquivos alterados: docs/agents/orquestracao.md, tools/alice-harness/README.md, tools/alice-harness/feature.py, tools/alice-harness/tests/test_feature_orchestrator.py
- Rodadas de reparo usadas: 0
- Revertidos só estes (invariante): nenhum
- Travas (commit separado `Trava: sim`, auditoria do Joel): nenhuma
- Problemas: nenhum

## Resumo do finish
JV15-1 e JV15-2 implementadas como candidatas, sujeitas à validação e confirmação transacional do runner. JV15-1: recheck-tests agora aceita tests done/error/escalated e continua exigindo arquivos, cenários, checks sob stub e SHAs; não chama Bia nem reescreve testes. JV15-2: no --stage all, implement só é pulado se implement.cards corresponder exatamente aos cartões implement atuais e todos estiverem done; --stage implement já selecionava os cartões do plano atual. Adiados/recusados: nenhum. Arquivos alterados: tools/alice-harness/feature.py, tools/alice-harness/tests/test_feature_orchestrator.py, tools/alice-harness/README.md, docs/agents/orquestracao.md. Travas aplicadas: nenhuma. Suíte de referência informada: 273 testes verdes. JV15-1 regressão antes da correção: 276 testes, 2 falhas esperadas; após correção: 276 verdes. JV15-2 regressão antes da correção: 278 testes, 2 falhas esperadas; após correção: 278 verdes (run_tests, unittest discover). Desvios/limites: não foi possível testar o estado real de E6-F01, ausente no worktree; fixtures reproduzem os mecanismos. Nenhum produto, estado real, cota ou orçamento alterado; nenhuma chamada real à Bia. Perguntas ao Joel: nenhuma. Não afirmo commit ou integração, reservados ao runner.

## Custo da execução do Jorge (runner)

| Medida | Valor |
|---|---:|
| Modelo(s) | gpt-6-sol |
| Requisições | 19 (falhas re-tentadas: 0, sem usage: 0) |
| Tokens de entrada | 218243 |
| Entrada em cache | 859379 |
| Tokens de saída | 7220 |
| Raciocínio (já na saída) | 0 |
| Créditos Abacus | 1017.28 |
| Passos análise / aplicação | 5 / 14 |
| Suítes rodadas | 4 |
| Início / fim | 2026-11-17T01:07:06-03:00 / 2026-11-17T01:08:39-03:00 |
