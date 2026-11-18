# harness-v14 — diagnóstico fiel no corte de chamadas

## Identificação

- **Versão:** harness-v14
- **Data:** 2026-11-17T01:04:00-03:00 (informada; relógio não aferido)
- **Execução:** Review harness-v14; ID adicional não informado.
- **Estado da versão:** proposta.
- **Escopo recebido:** estouro de `toolCalls` na implementação de E6-T02/T04/T06 e E7-T09/T10 depois da v13; investigar aviso, margem e adequação do teto sem alterar produto ou orçamentos. Análise ≤40 passos, aplicação ≤60, leitura ≤400 linhas, teto informado de 3000 créditos.
- **Fontes recebidas:** anotação 2026-11-17T01:04:00-03:00; `tools/jorge/logs/harness-v13/relatorio.md` (JV13-4/5 recusadas e JV13-1/2/3 verificadas pelo runner), `harness-v12/relatorio.md`; `tools/alice-harness/runs/retro-20261117-010313.md`, `retro-20261117-004715.md`, `retro-20261117-004956.md`; logs e estados E7-T09/20261117-005939 e E7-T10/20261117-010059. Nenhuma retro indicada nominalmente.
- **Base git:** `233808725b8169befb1434016276b3c239b54563` (`docs/mvp-planning`); worktree isolado `jorge/harness-v14` informado.
- **Workspace inicial:** worktree isolado informado; limpeza não aferível por ferramentas disponíveis.
- **Modelo/provedor efetivamente utilizados:** `gpt-6-sol` informado, metadados efetivos da API não disponibilizados nesta análise.
- **Autorizações de Joel:** nenhuma nova; não aumentar nenhum orçamento/cota nem afrouxar travas.
- **Suíte de referência:** VERDE, 270 testes, `python3 -m unittest discover -s tests` no harness, informada pelo runner; falhas/erros zero inferidos; ignorados não informados.

## Diagnóstico

### Fatos confirmados

- `metricas(evolution)` registra 5/5 E6 não done (média 27 tool calls, 466.281 tokens de entrada) e 2/2 E7 não done (média 23 tool calls, 373.654 tokens). `metricas(metrics)` cobre 36 execuções, 18 done, 21.119.195 tokens de entrada acumulados de Alice; não é custo deste Review. Retro `010313.md:5-22`: T09 25 chamadas/374.126 tokens e T10 21/373.182, ambos limite nominal 20. T09 log:1-46 chega a teste focal verde somente na chamada 25, sem evidência de typecheck/lint verdes; T10 log:23-42 recebe teste vermelho e entra em interpretação repetitiva incorreta de `z.int()` e quatro respostas sem ferramentas, sem `finish`. Em T10 `state.json:492-515`, o aviso chegou **após** o resultado da 20ª chamada; a chamada 21 foi `run_check(-1)`, e o teste continuou vermelho com 13 erros TypeScript em dois componentes e lint vermelho. Não se trata apenas de aviso não entregue.
- `alice.py:927-1037` entrega o aviso após todo o lote; `gates.py:108-134` permite quatro chamadas adicionais e falha na quinta. Um lote com cinco `read_file` pode atravessar o teto antes de o aviso chegar. T09 começou com cinco leituras no mesmo lote (`log.jsonl:1-6`) e alcançou 25 chamadas (`state.json:609-620`); a causa exata de seu disparo no corte precisa de teste do laço, não se presume número de turnos só pelo log. `alice.py:1029-1037` acusa ‘aviso pediu run_check e finish’ mesmo se o aviso só puder chegar depois do lote ou se `run_check(-1)` de fato ocorrer. `alice.py:950-951` conta chamada antes de dispatch, `alice.py:939-941` também conta resposta sem ferramenta, enquanto `stats.tool_calls` não a conta; em T10 foram quatro respostas sem ferramenta após a chamada 21 (`log.jsonl:39-42`, `state.json:518-547`), portanto não houve quinto tool call real. `CallBudget` só verifica `status()` no fim do turno e não grava motivo de corte.
- `alice.py:826-866` já faz verificação completa do diff, testes protegidos e checks em `finish`; `alice.py:575-583` executa checks por índice ou todos em `-1`. `alice.py:962-996` só dá `done` após `verify()` verde; nenhum corte pode dispensar isso. `cards.py:246-248,366-368` exige mínimo 8+3 por check (17 para três checks); `docs/plano/E7.yaml:402-485` fixa 20 para dois componentes com três checks, e os hints dos dois já explicitam BigInt→cents (`:428`, `:470`). `cards.size_model` determina limites de **tamanho** de contexto/escrita, não `budget.toolCalls` (`alice.py:140-149,717-729`).
- `docs/plano/E7-F03/estado.json` citado na anotação não existe neste worktree (leitura retornou ENOENT); `docs/plano/E7.yaml` e os logs E7 estão disponíveis. A v13 corrigiu ordem, restauração e dependências externas conforme `harness-v13/relatorio.md:135-147`; F03 não tem a dependência externa E6 que explicava F02.

### Causas e hipóteses

- **Confirmada:** detecção do orçamento só após o lote (possível aviso tardio); cobrança de `finish` sem demonstrar checks verdes; motivo final do estouro afirma desobediência mesmo quando a ferramenta foi usada ou quando falha técnica impedia aprovação. Respostas sem tool call podem consumir a margem interna sem refletir em `toolCalls` público.
- **Não confirmada:** que ampliar `toolCalls` faria os componentes passarem, nem que os 20 sejam sempre suficientes: T09 alcançou teste focal verde na 25ª, mas não comprovou typecheck/lint; T10 permaneceu vermelho depois da verificação, e erros de tipagem de arquivo vizinho ampliaram a dificuldade. Qualidade da solução do produto/hints, feedback truncado e tamanho do cartão podem influir, mas alterar produto/plano está fora do Review. Aumentar o limite aumenta custo potencial sem prova de sucesso.

### Justificativa econômica

- Cinco falhas E6 + duas E7 em três features, com centenas de milhares de tokens de entrada por execução (fontes acima). Proposta pequena para assegurar que lote não consuma a margem invisivelmente e que o fracasso traga diagnóstico fiel, permitindo decidir fatiamento/correção do cartão sem novas rodadas cegas. Economia de tokens é **hipótese**, não medida; registrar o check vermelho é mais valioso do que simplesmente aumentar orçamento. Um check adicional local apenas quando o limite encerra sem `finish` custa tempo; aproveitar cache quando possível.

## Evoluções

| ID | Problema | Evidência — arquivo:linha na base ou retro | Mudança | Arquivos | Teste que prova | Risco | Tipo | Status |
|---|---|---|---|---|---|---|---|---|
| JV14-1 | Lote ultrapassa limite/grace antes de aviso; corte sem evidência de checks | `alice.py:927-1037`; `gates.py:108-134`; T09 `log.jsonl:1-6,45-46`, T10 `state.json:492-515` | Processar aviso/corte por chamada, preservar limite/grace e impedir execução de ferramentas extras após corte; no corte da implementação registrar resultado dos checks via verificação local, falhar fechado, apontando checks vermelhos em vez de alegar exclusivamente desobediência | `tools/alice-harness/alice.py`, `tools/alice-harness/tests/test_no_op_and_budget.py` | lote de chamadas ao atingir 20 recebe aviso no próximo turno e não executa ferramentas além da margem, vermelho nunca done; teste negativo `0/0` e ferramenta com erro | médio: compatibilidade de mensagens e `finish` em lote; não perder retorno de ferramentas já executadas | correção | adiada — aguardando aplicação |
| JV14-2 | Suposto ajuste automático de `toolCalls` ou aumento de grace para componentes | `cards.py:246-248`; `E7.yaml:402-485`; T09 `log.jsonl:45-46`; T10 `state.json:492-515` | Não alterar tetos do cartão, tentativas, grace nem `size_model`; depender de execução controlada e possível fatiamento pelo responsável do produto | nenhum | futura comparação de execuções com todos os checks verdes e consumo por check; ausente | alto: permitir loops caros sem comprovar sucesso | correção | recusada — aumento não justificado |

### JV14-1 — corte preciso e falha diagnosticável

- **Causa e comportamento atual:** `budget.status()` roda depois de todo o lote de tool calls; o aviso aparece só no turno seguinte, e um lote pode gastar mais que a margem antes de um aviso visível. `stop` retorna mensagem invariável sem inspecionar resultados; `run_check(-1)` do T10 foi atendido, mas checks ficaram vermelhos. Respostas sem ferramentas contam apenas no orçamento interno.
- **Comportamento pretendido:** não executar ferramentas após o corte; aviso só se houver chance de ser visto, emitido após concluir o lote parcial e antes da próxima resposta; `finish` sempre validado por `verify()` e nenhum check vermelho, erro de ferramenta ou cobertura `0/0` recebe `done`. Quando a margem acaba sem `finish`, obter diagnóstico local de `verify()` (checks e integridade) e registrar status `failed` com motivo real (‘limite ...; checks ainda vermelhos ...’ ou ‘sem finish’) sem exigir novos pedidos ao modelo. Preservar auditoria de chamadas efetivamente recebidas e tornar explícita a diferença entre chamadas e turnos vazios.
- **Implementação mínima:** mover a avaliação do orçamento para a fronteira de cada chamada em `Run.loop`, interromper despacho do restante do lote ao atingir `stop` sem executar novas ferramentas; manter o nudge em uma única mensagem após o lote, de preferência parar antes de contar/realizar chamadas fora da margem; no caminho `stop` usar verificação local já existente (com resultado redigido/truncado via mecanismo de `verify`) para compor diagnóstico, sempre `failed`. Se a estrutura da resposta exigir resultado de ferramenta para cada chamada anunciada, adicionar resposta sintética **somente às chamadas já anunciadas e não executadas**, marcando que foram recusadas, sem fingir execução. Não mudar `CallBudget` limite/grace, contagem `stats.tool_calls` de tool calls reais ou esquema de relatório sem teste.
- **Fora do escopo:** editar implementação/testes de produto, schema ou `docs/plano/**`; aumentar budget, grace ou remover checks; retentar automaticamente a Alice; permitir `finish` virar verde sem validação. Se não for possível preservar o protocolo de mensagens de lote com corte, parar a evolução e registrar impedimento.
- **Dependências e ordem:** nenhuma; JV14-2 recusada e não bloqueia.
- **Prova de regressão:** dublê `Run.chat` fornece lote com mais chamadas do que limite+grace; verificar que não despacha chamadas além da margem, resultado de aviso é entregue antes da resposta subsequente quando há margem, e no stop reporta motivo do `verify()` sem sucesso. Simular T10: depois do aviso o modelo chama `run_check(-1)`, retorna check vermelho, depois não finaliza; erro final deve citar check vermelho, não dizer falsamente que nunca atendeu ao pedido. Contar também lote que contém `finish` válido: deve continuar verde sem bypass; `finish` inválido não dá done; resposta sem ferramentas não estoura silenciosamente sem justificativa. Testar `run_cmd` falso com 0/0 (ou preservar `CoverageCheckTest`) e exceção/erro do check; confirmar ambos falham fechado. Teste novo deve falhar antes da alteração pelo despacho de chamadas extras ou diagnóstico incorreto e passar depois.
- **Casos negativos/limites:** o teste focal verde sozinho (T09) não aprova typecheck/lint; nenhum `0/0` vira verde; erro de `verify()` deve falhar fechado e ser registrado, não fingir checks verdes. `ask_claude` e `finish` dentro do lote mantêm sua semântica anterior; em caso de conflito de protocolo, adiar, não ocultar chamada.
- **Compatibilidade:** CLI e configuração inalteradas; consumidores Alice/Claude recebem aviso no primeiro turno possível e motivo mais fiel no relatório/retro, status continua `failed`, `stats.tool_calls` continua contagem de chamadas reais; mensagens de erro mudam (usuários que buscam texto exato devem migrar para status e detalhe). Custo local de verificação no corte, em parte via cache; nenhum aumento permitido de chamadas à Alice/Bia, nenhuma economia medida.
- **Auditoria:** não aplicável (portão/diagnóstico comum, não trava). **Autorização:** investigação e correção mecânica solicitadas no escopo, sem afrouxar trava.
- **Custo/benefício esperado:** menor superfície em um laço e teste simulado, sem medida de sucesso até novas execuções; pode evitar retrabalho de diagnóstico, mas checks locais consomem tempo.
- **Resultado observado:** pendente de aplicação e suíte.
- **Motivo do status:** adiada — aguardando aplicação.

### JV14-2 — não trocar evidência por orçamento

- **Causa e comportamento atual:** orçamento de chamadas vem do cartão (`alice.py:725-729`), não da conta de tamanho `cards.size_model`; `min_tool_calls` é piso aproximado, não estimativa de que um componente React com testes complexos conclui em 20 chamadas.
- **Comportamento pretendido/implementação mínima:** nenhuma mudança; preservar teto/grace e solicitar ao dono do plano verificar dimensionamento e hints/fragmentação por evidência de execução com checks finais completos.
- **Fora do escopo:** editar `docs/plano/E7.yaml` ou produzir solução de produto; afrouxar orçamento por iniciativa do Review.
- **Dependências:** nenhuma. **Prova/casos negativos:** só futura comparação com checks todos verdes pode justificar teto; caso 0/0 e check vermelho permanecem falha. **Compatibilidade:** CLI/config/consumidores inalterados; custo imediato zero, evita custo potencial de loops longos.
- **Auditoria:** não aplicável; nenhuma trava alterada. **Autorização:** nenhuma para afrouxamento; não solicitado. **Resultado observado:** sem mudança.
- **Motivo do status:** recusada — ausência de prova de que aumentar orçamento solucione o erro.

## O que ficou para Joel decidir

| Decisão | Evolução | Motivo | Opções e recomendação | Bloqueia aplicação? |
|---|---|---|---|---|
| Nenhuma decisão requerida para JV14-1 | — | correção de orquestração sem aumentar cotas/travas | manter tetos e checks; se futuramente quiser mais chamadas, coletar prova de todos os checks e perguntar objetivamente | Não |

Mudanças em `docs/plano/**` ou `apps/**` (por exemplo, dividir cartões e corrigir código) não estão autorizadas por este relatório; responsável da entrega decide fora do Review.

## Execução e suíte

| Momento | Evolução | Resultado | Executados | Falhas | Erros | Ignorados | Evidência |
|---|---|---|---:|---:|---:|---:|---|
| Referência | — | VERDE informado | 270 | 0 inferido | 0 inferido | não informado | pedido do runner |
| Regressão antes da correção | JV14-1 | não executada: análise só leitura | — | — | — | — | análise |
| Após evolução | JV14-1 | pendente | — | — | — | — | aplicação |
| Final — runner | — | pendente | — | — | — | — | runner |

- **Comando:** `python3 -m unittest discover -s tests`, no diretório do harness.
- **Anomalias de descoberta/contagem:** nenhuma informada; zero testes não é verde.
- **Tentativas e falhas intermediárias:** nenhuma suíte rodada na análise.
- **Desvios do relatório inicial:** nenhum nesta fase.
- **Resultado transacional:** pendente do runner. **Commit:** pendente do runner.
- **Se não aplicado:** registrar impedimento e diff preservado pelo runner. **Evoluções revertidas:** nenhuma na análise.

## Custo da execução do Jorge

Dados da API e do runner indisponíveis nesta análise; não inferir custo monetário, créditos efetivos nem consumo do Review a partir das métricas de Alice.

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
- **Estimativas separadas dos valores medidos:** somente efeito qualitativo; 373–374k tokens são de execuções anteriores da Alice, não do Jorge.
- **Consumo de Bia:** nenhum pelo Review.
- **Conclusão:** limitar o despacho e registrar a falha comprovada pode reduzir diagnósticos falsos e repetições futuras; nenhuma economia realizada pode ser declarada nesta fase.

---
## Verificação do runner
- Status: **aplicada**
- Base: `233808725b8169befb1434016276b3c239b54563`
- Suíte final: VERDE, 273 testes (referência 270)
- Arquivos alterados: tools/alice-harness/alice.py, tools/alice-harness/tests/test_no_op_and_budget.py
- Rodadas de reparo usadas: 0
- Revertidos só estes (invariante): nenhum
- Travas (commit separado `Trava: sim`, auditoria do Joel): nenhuma
- Problemas: nenhum

## Resumo do finish
JV14-1 candidata implementada: avaliação do limite por chamada no laço da Alice; o restante do lote é recusado sem executar nem contabilizar chamadas não realizadas, e o corte falha fechado com diagnóstico da verificação local (checks vermelhos, inclusive 0/0). Aviso continua no turno seguinte; finish dentro da margem continua sujeito à verificação completa. JV14-2 recusada: aumentar toolCalls/grace sem comprovação de sucesso dos checks ampliaria custo e loops; nenhum orçamento alterado. Arquivos alterados: tools/alice-harness/alice.py e tools/alice-harness/tests/test_no_op_and_budget.py. Travas aplicadas: nenhuma. Suíte de referência informada: 270 verdes. Regressão antes da correção: 272 testes, 2 falhas esperadas; após alteração, 272 verdes; acrescido teste para finish inválido durante a margem: 273 verdes finais (`run_tests`, python3 -m unittest discover -s tests). Ocorreram rodadas intermediárias vermelhas por ajustes dos dublês de teste; não houve testes de produto nem chamadas reais à Bia. Desvio: verificação local no stop usa o mesmo verify do finish e limita/redige a mensagem; resultados das ferramentas anunciadas mas não executadas são marcados BLOQUEADO, sem mexer em grace/budget. Perguntas ao Joel: nenhuma. Confirmação de aplicação, suíte final, commit e integração são do runner.

## Custo da execução do Jorge (runner)

| Medida | Valor |
|---|---:|
| Modelo(s) | gpt-6-sol |
| Requisições | 32 (falhas re-tentadas: 0, sem usage: 0) |
| Tokens de entrada | 471189 |
| Entrada em cache | 2485513 |
| Tokens de saída | 9135 |
| Raciocínio (já na saída) | 0 |
| Créditos Abacus | 2067.32 |
| Passos análise / aplicação | 8 / 24 |
| Suítes rodadas | 6 |
| Início / fim | 2026-11-17T01:04:00-03:00 / 2026-11-17T01:06:21-03:00 |
