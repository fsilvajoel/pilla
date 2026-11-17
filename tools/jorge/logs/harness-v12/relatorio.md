# harness-v12 — revalidação de testes e isolamento entre features

## Identificação

- **Versão:** harness-v12
- **Data:** 2026-11-17T00:05:18-03:00 (informada; relógio não aferido)
- **Execução:** Review harness-v12; ID adicional não fornecido.
- **Estado da versão:** proposta.
- **Escopo recebido:** E6-F01/F02 em `tests: escalated`; tipos incorretos no reparo da Bia, checks de pacote contaminados por testes F01 e falta de revalidação sem Bia; duas anotações sobre stub da v11 (a segunda registra ajuste autorizado já feito). Análise ≤40 passos, aplicação ≤60, leitura ≤400 linhas, teto 3000 créditos.
- **Fontes recebidas:** anotações de 2026-11-16T23:49:13 e 23:55:07 e 2026-11-17T00:05:18-03:00; `tools/jorge/logs/harness-v11/relatorio.md` (inclusive verificação do runner); `tools/alice-harness/runs/retro-20261117-000218.md` e `retro-20261117-000424.md`; `docs/plano/E6.yaml` e arquivos de código citados. Nenhuma retro indicada explicitamente.
- **Base git:** `cc403d2a97b4194050eb2df8eb76f59667885261` (`docs/mvp-planning`); worktree `jorge/harness-v12` informado.
- **Workspace inicial:** worktree isolado informado; limpeza não aferível por ferramentas de leitura.
- **Modelo/provedor efetivamente utilizados:** `gpt-6-sol` informado; metadados efetivos da API indisponíveis na análise.
- **Autorizações de Joel:** anotação 23:55:07 informa autorização 7c9baee para stub marcado; implementação já consta em `scripts/guard_hook.py:101-155`, sem nova mudança de trava proposta. Nenhuma autorização para alterar orçamento.
- **Suíte de referência:** VERDE, 260 testes (`python3 -m unittest discover -s tests` em `tools/alice-harness`), informada pelo runner; ignorados não informados.

## Diagnóstico

### Fatos confirmados
- As duas retros registram `tests: escalated` por checks vermelhos após um reparo em lote; F01 consumiu **2/3**, F02 **2/2** requisições declaradas (`retro-20261117-000218.md:3-7`, `retro-20261117-000424.md:3-7`). Não registram saída dos checks ou arquivos afetados. `metricas(metrics)` cobre 29 execuções antigas de cartões, 18 done (62,1%), média 1,97 tentativas e 196,48 s; `metricas(evolution)` termina em E4-T09, **não** mede a leva E6.
- O plano E6 configura `pnpm --filter @pilla/web typecheck` e `lint` em todos os test-author (`docs/plano/E6.yaml:14-18,86-90,154-158`); `apps/web/tsconfig.json:10` inclui `**/*.ts`/`**/*.tsx`. `feature.py:303-308,347-381` executa diretamente todos os checks sob o stub, logo erros de testes alheios podem reprovar a feature atual. `feature.py:362-390` sempre pede novos arquivos à Bia antes de verificar, com no máximo um reparo; não existe etapa de rechecagem local que mantenha os shas/cenários e não sobrescreva testes. `feature.py:384-391` grava `testShas`, `expectRed` e `scenarios` mesmo no escalated após o reparo, dados úteis à rechecagem.
- `feature.py:257-277` fornece plano, `readFirst` e contrato de cada cartão da própria feature; `docs/plano/E6.yaml:37-40,106-110` já inclui `packages/schemas/src/api/lending/simulate-loan.ts`. O esquema declara `SimulateLoanRequest` via `z.infer` e campos tipados (`packages/schemas/src/api/lending/simulate-loan.ts:10-24`). A anotação reporta confusão entre números e `cents()/bps()` e import sem `type`; os testes concretos não existem neste worktree e os diretórios `runs/feature/E6-F01/...` e `E6-F02/...` estão vazios. `roles/qa.md:19-24,32-34` cobra TypeScript estrito e reparo completo, sem instrução explícita para conferir os tipos do esquema antes de escrever ou reparar.
- O incidente antigo de stub já recebeu a solução marcada: `scripts/guard_hook.py:101-155` aceita `// @stub <ID>` com placeholder e nenhum `return` para Write/Edit; testes incluem TSX e `Card-Done` ainda marcado (`tests/test_guard_hook.py:70-125`). A v11 terminou com 258 testes verdes (`harness-v11/relatorio.md:121-133`). Não duplicar essa alteração nesta versão.

### Causas e hipóteses
- **Confirmada no código:** checks de pacote são compartilhados, não isolados; a etapa `tests` faz uma chamada Bia antes de qualquer verificação local e não tem revalidação sem modelo. O `all` termina ao receber `escalated` (`feature.py:610-625`).
- **Não confirmada:** conteúdo exato dos testes F01/F02 e saídas de typecheck/lint; a anotação atribui F02 a F01 e F01 aos tipos, mas os logs de execução disponíveis aqui não trazem detalhes. Contexto adicional de esquema no prompt pode ajudar, não prova correção sem teste real. Isolar `tsc`/lint do pacote por arquivos sem perder erros transitivos não tem solução segura demonstrada; não desligar check nem alegar F02 verde sem executá-lo.

### Justificativa econômica
- Duas features escalated em sequência; F02 gastou a totalidade do teto declarado (2/2). Um portão local antes da chamada Bia e uma rechecagem explícita têm superfície pequena, evitam consumo de modelo quando há falha compartilhada ou o trabalho já está corrigido; economia efetiva futura não mensurada, checks locais podem custar segundos. Acrescentar contexto **curto e já previsto em `readFirst`** custa tokens e pode evitar o erro de tipos, mas a eficácia é incerta. Retirar ou restringir typecheck de pacote seria arriscado e pode ocultar erro: adiar até haver alternativa equivalente demonstrável.

## Evoluções

| ID | Problema | Evidência — arquivo:linha na base ou retro | Mudança | Arquivos | Teste que prova | Risco | Tipo | Status |
|---|---|---|---|---|---|---|---|---|
| JV12-1 | F02 consome Bia com checks de pacote contaminados | anotação 00:05:18; `docs/plano/E6.yaml:154-158`; `feature.py:303-308,351-363`; retro F02:3-7 | antes de pedir à Bia, rodar apenas os checks declarados **não expect-red** dos cartões da feature sob o stub; se vermelho, parar `tests` com diagnóstico local, sem escrever arquivos ou consumir Bia | `tools/alice-harness/feature.py`, `tools/alice-harness/tests/test_feature_orchestrator.py` | fixture com typecheck/lint vermelho de arquivo alheio impede chamada Bia; verde mantém caminho usual; falha de stub não aprova | médio — checks existentes podem exigir teste prévio; limitar preflight aos checks de pacote previamente existentes, nunca qualidade/expect-red do teste ainda não escrito | correção | adiada — aguardando aplicação |
| JV12-2 | correção externa não pode revalidar F02 sem gastar/sobrescrever pela Bia | `feature.py:351-391,610-625`; retro F02:3-7 | acrescentar etapa explícita `--stage recheck-tests` que executa os mesmos checks da etapa tests sobre arquivos já escritos, sob stub HEAD, sem `ask`/`write_files`; conservar shas/cenários válidos e exigir arquivos presentes e hash atualizado antes de marcar done | `tools/alice-harness/feature.py`, `tools/alice-harness/alice.py`, `tools/alice-harness/tests/test_feature_orchestrator.py`, `tools/alice-harness/README.md`, `docs/agents/orquestracao.md` | escalated com testes corrigidos + todos checks verdes vira done, 0 chamadas novas, shas recalculados; check vermelho, arquivo ausente, cenários ausentes e erro de stub não aprovam | médio — interface nova e estado de testes; falha fechada | correção | adiada — aguardando aplicação |
| JV12-3 | Bia erra tipos do contrato apesar de o esquema já estar no prefixo | anotação 00:05:18; `feature.py:270-277`; `roles/qa.md:19-34`; `packages/schemas/src/api/lending/simulate-loan.ts:10-24` | orientação curta de QA: antes de escrever/reparar, conferir tipo inferido e import type nos contratos já incluídos; erros de typecheck têm prioridade no reparo, sem anexar novamente tsconfig/esquema | `tools/alice-harness/roles/qa.md`, `tools/alice-harness/tests/test_feature_orchestrator.py` | pedido inicial e reparo incluem orientação e esquema já disponível via readFirst; caso sem esquema não inventa contrato | baixo — texto adicional não garante aderência | agente | adiada — aguardando aplicação |
| JV12-4 | substituir typecheck/lint de pacote por versões de arquivo | anotação 00:05:18; `apps/web/tsconfig.json:10`; `feature.py:303-308` | não alterar checks sem prova de equivalência; em vez disso portão JV12-1 e rechecagem JV12-2 | nenhum | proposta só com teste de compilação equivalente de dependências, ainda inexistente | alto — esconder erros válidos | simplificação | recusada — isolamento sem equivalência demonstrada |
| JV12-5 | repetir alteração de stub v11 | anotação 23:49:13, autorização 23:55:07; `scripts/guard_hook.py:101-155` | nenhuma, já corrigido nesta base; manter trava e auditoria anteriores | nenhum | `tests/test_guard_hook.py:70-125` existente | baixo — duplicação desnecessária | trava | recusada — já atendida |

### JV12-1 — preflight dos checks compartilhados
- **Causa e comportamento atual:** Bia é chamada em `stage_tests` antes de executar typecheck/lint; checks de pacote veem outros testes na árvore.
- **Comportamento pretendido:** quando um check de pacote já está vermelho antes de qualquer escrita da Bia, não atribuir a falha à feature nova nem gastar orçamento. Preservar os checks originais depois de escrever os testes; não declarar done por preflight isolado.
- **Implementação mínima:** antes de `ask`, usar os comandos `typecheck`/`lint` declarados nos cartões test-author (deduplicados) via `ops.run_checks`, preferencialmente identificados como checks compartilhados do pacote e sem executar expect-red/qualidade ou checks de teste ainda não existente; diante de erro, status `escalated`/diagnóstico com comando e saída limitada/redigida, **zero Bia**. Se a distinção não for segura num plano, não filtrar comandos genéricos por substring para aprovar: apenas aplicar aos comandos de pacote reconhecidos e manter validação completa após escrita.
- **Fora do escopo:** alterar checks em `docs/plano/E6.yaml`, remover typecheck/lint ou limpar testes F01 em `apps/**`.
- **Dependências e ordem:** nenhuma; antes de JV12-2.
- **Prova de regressão:** FakeOps com check global inicialmente vermelho, teste futuro ainda ausente: antes chama Bia, depois não chama; erro local identificado e status não done. Contraprova verde com `test_happy_path`; preservar teste `0/0` já reprovado (`tests/test_test_guardrails.py:27-40`).
- **Casos negativos/limites:** falha de comando ou ausência de resultado é vermelho, não verde; checks de qualidade/expect-red só após criação dos testes. Não chamar Bia quando não é possível distinguir check global com segurança; preferir status de erro e registro para Claude.
- **Compatibilidade:** sem mudança de sintaxe CLI/config; consumidores são Claude e etapa tests, que verão `escalated` local sem Bia; custo de até um typecheck/lint local extra por feature (deduplicado), evita requisição somente quando identifica falha anterior.
- **Auditoria:** não aplicável, portão comum. **Autorização:** escopo recebido. **Custo/benefício esperado:** caso relatado de F02 (2/2), benefício potencial de poupar chamadas futuras; não mensurado. **Resultado observado:** pendente. **Motivo do status:** adiada — aguardando aplicação.

### JV12-2 — recheck explícito, sem novo gasto
- **Causa e comportamento atual:** repetição de `--stage tests` sobrescreve testes mediante nova chamada e não pode prosseguir com orçamento esgotado.
- **Comportamento pretendido:** revalidar testes existentes depois de correção externa, sem invocar Bia, sem escrever arquivos de teste e sem marcar `done` se qualquer check/arquivo/cenário falhar. `expect-red` deve continuar passando sob stub do HEAD; atualizar hashes dos arquivos rechecados para pré-voo de implementação.
- **Implementação mínima:** entrada CLI exclusiva `--stage recheck-tests`, não novo estado `STAGES`; confirmar estado anterior `tests: escalated` e `scenarios` não vazios que cobrem todos os cenários atuais do plano, arquivos test-author presentes, then executar `checks_against_stub`; somente em verde salvar `testShas`, `expectRed`, `testes.md` e `tests: done` preservando contador de chamadas/reparos. Não acionar `stage_plan` como reescrita nem Bia; plano válido continua pré-condição. Rechecagem com `0/0` se houver check de cobertura é vermelha via `bia.run_checks`/`alice.run_cmd`.
- **Fora do escopo:** reescrever testes F01/F02 ou conceder auditoria/aceite automático; chamar Bia com cota extra; incluir recheck silencioso no `all`.
- **Dependências e ordem:** após JV12-1 (independência funcional).
- **Prova de regressão:** fixture persiste escalated após erro, corrige arquivo na árvore temporária, força 0 respostas Bia e verifica `done`, `biaRequests` inalterado, SHA do conteúdo corrigido e testes.md verde; negativo: checks continuam vermelhos, cenário ausente, teste ausente ou stub ilegível não marcam done e não gastam Bia; `0/0` não é verde.
- **Casos negativos/limites:** hashes não nulos dos arquivos presentes, estado sem cenários não é certificado; não fazer aprovação apenas por SHAs gravados antes; ferramenta/checkout de stub falhou → error e estado não done.
- **Compatibilidade:** CLI ganha opção opt-in `recheck-tests`, mantém `--stage tests` e `all`; sem novo campo de configuração nem mudança de orçamento. Consumidores: Claude decide quando invocar, Alice recebe somente SHA dos testes validados, Bia não chamada. Checks locais podem custar minutos, economia potencial até uma chamada por revalidação, não contabilizada como realizada.
- **Auditoria:** não aplicável. **Autorização:** escopo recebido. **Custo/benefício esperado:** F02 esgotou 2/2; evita nova chamada quando só checks externos foram sanados, mas não corrige testes ruins. **Resultado observado:** pendente. **Motivo do status:** adiada — aguardando aplicação.

### JV12-3 — contrato tipado na instrução, sem duplicar fonte
- **Causa e comportamento atual:** esquema e stub já aparecem no prefixo; instruções do papel não ligam explicitamente o reparo ao tipo real inferido pelo Zod e aos imports sob TypeScript estrito. Não há prova de que repetir o tsconfig inteiro resolveria o erro.
- **Comportamento pretendido:** pedir à Bia que confira os tipos no contrato `readFirst` antes de criar valores e, ao reparar, use diagnósticos `arquivo:linha` do check, corrigindo imports type-only e mantendo os campos com os tipos exigidos, sem casts falsos.
- **Implementação mínima:** duas frases em `roles/qa.md`, aproveitando prefixo estável existente; nenhum novo anexo de tsconfig, mudança de schema ou tipo de produto.
- **Fora do escopo:** correção do teste/contrato em `apps/**` ou `packages/**`, alterar tamanho de contexto por constante, prometer sucesso do modelo.
- **Dependências e ordem:** após JV12-1/2; funcionalmente independente.
- **Prova de regressão:** teste de construção do prompt confirma presença da orientação em chamadas inicial/reparo e contrato lido de arquivo temporário; ausência de schema/readFirst não inventa tipos; checks mecânicos permanecem obrigatórios.
- **Casos negativos/limites:** se Bia continuar produzindo teste inválido, permanece escalated; sem aprovação por texto do prompt, cobertura `0/0` continua vermelha.
- **Compatibilidade:** CLI/config inalteradas; consumidor Bia vê poucas frases novas em prompt; custo em tokens positivo e não quantificado, eventual economia por menor reparo/escalada é hipótese.
- **Auditoria:** não aplicável. **Autorização:** anotação recebida para avaliar prompt. **Custo/benefício esperado:** baixo esforço/baixo risco, benefício incerto. **Resultado observado:** pendente. **Motivo do status:** adiada — aguardando aplicação.

### JV12-4 — não esconder erros do pacote
- **Causa e comportamento atual:** tsc inclui todos os TS/TSX, o plano usa checks amplos; tirar arquivos pode perder erros transitivos.
- **Comportamento pretendido/implementação mínima:** sem mudança nesta versão; tratar causa de contaminação cedo e permitir revalidação.
- **Fora do escopo:** mexer no tsconfig real ou nos cartões/produto. **Dependências:** nenhuma.
- **Prova/casos negativos:** futuros testes devem provar que isolamento preserva erros de dependências e 0/0; prova indisponível.
- **Compatibilidade:** nenhuma alteração CLI/config/consumidores, custo adicional nenhum. **Auditoria:** não aplicável. **Autorização:** desnecessária para recusar. **Custo/benefício:** evita falso verde. **Resultado observado:** não aplicar. **Motivo do status:** recusada — benefício incerto e risco alto.

### JV12-5 — stub já resolvido
- **Causa e comportamento atual:** a primeira anotação descreve trava antiga; a segunda registra substituição autorizada, já materializada no código e nos testes da base.
- **Comportamento pretendido/implementação mínima:** manter funcionamento existente, sem abrir outra exceção de hook.
- **Fora do escopo:** stubs/soluções em `apps/**`; ajustes na trava sem novo incidente comprovado. **Dependências:** nenhuma.
- **Prova/casos negativos:** testes existentes de stub marcado, retorno recusado e Done ainda marcado recusado; execução final da suíte preserva-os.
- **Compatibilidade:** CLI/config/consumidores inalterados; custo adicional nenhum. **Auditoria:** trava existente auditada na v11, nenhuma nova. **Autorização:** 7c9baee conforme anotação, já aplicada anteriormente. **Custo/benefício:** evitar duplicação. **Resultado observado:** nenhuma nova alteração. **Motivo do status:** recusada — já atendida.

## O que ficou para Joel decidir

| Decisão | Evolução | Motivo | Opções e recomendação | Bloqueia aplicação? |
|---|---|---|---|---|
| Nenhuma obrigatória nesta versão | — | recheck e preflight são portões comuns dentro do escopo, sem aumento de cota/trava | Manter checks integrais; se futuramente desejar isolamento de tsc/lint, exigir equivalência e nova evidência | Não |

Mudanças necessárias fora da lista de escrita: nenhuma nesta proposta. A correção dos testes concretos ou limpeza do worktree de produto é de quem conduz a entrega; Jorge não a executa nem modifica `docs/plano/**`, `apps/**` ou `packages/**`.

## Execução e suíte

| Momento | Evolução | Resultado | Executados | Falhas | Erros | Ignorados | Evidência |
|---|---|---|---:|---:|---:|---:|---|
| Referência | — | VERDE informado | 260 | 0 (inferido) | 0 (inferido) | não informado | pedido do runner |
| Regressão antes da correção | JV12-1/2/3 | não executada: análise só leitura | — | — | — | — | análise |
| Após evolução | — | pendente | — | — | — | — | aplicação |
| Final — runner | — | pendente | — | — | — | — | runner |

- **Comando:** `python3 -m unittest discover -s tests`, no diretório do harness.
- **Anomalias de descoberta/contagem:** nenhuma informada; zero testes não é verde.
- **Tentativas e falhas intermediárias:** nenhuma suíte executada nesta análise.
- **Desvios do relatório inicial:** nenhum até aqui.
- **Resultado transacional:** pendente do runner; **Commit:** pendente do runner.
- **Se não aplicado:** registrar motivo e referência ao diff preservado pelo runner.
- **Evoluções revertidas:** nenhuma nesta fase.

## Custo da execução do Jorge

Dados API/runner indisponíveis nesta fase; não deduzir custos nem consumo a partir do nome configurado.

| Medida | Valor | Fonte/observação |
|---|---:|---|
| Requisições à API, incluindo retries | indisponível | runner |
| Tokens de entrada | indisponível | usage |
| Tokens de saída | indisponível | usage |
| Tokens totais | indisponível | sem dupla contagem; runner |
| Entrada em cache | indisponível | usage |
| Raciocínio | indisponível | runner informará se incluído na saída |
| Custo monetário | indisponível | runner/preços |
| Chamadas de ferramentas / suítes | indisponível / 0 nesta análise | runner |
| Duração total | indisponível | runner |

- **Cobertura da medição:** parcial, aguardando runner.
- **Estimativas separadas dos valores medidos:** nenhum valor monetário ou tokens estimados; somente trade-off qualitativo de mais checks locais versus chamadas evitáveis.
- **Consumo de Bia:** nenhum pelo Review; 2/3 e 2/2 são consumo das features relatadas nas retros, não custo de Jorge.
- **Conclusão:** proposta visa detectar contaminação antes de gastar Bia e liberar rechecagem sem nova requisição, sem alegar economia realizada ou alterar limites.

---
## Verificação do runner
- Status: **aplicada**
- Base: `cc403d2a97b4194050eb2df8eb76f59667885261`
- Suíte final: VERDE, 265 testes (referência 260)
- Arquivos alterados: docs/agents/orquestracao.md, tools/alice-harness/README.md, tools/alice-harness/alice.py, tools/alice-harness/feature.py, tools/alice-harness/roles/qa.md, tools/alice-harness/tests/test_feature_orchestrator.py
- Rodadas de reparo usadas: 0
- Revertidos só estes (invariante): nenhum
- Travas (commit separado `Trava: sim`, auditoria do Joel): nenhuma
- Problemas: nenhum

## Resumo do finish
Candidatas implementadas: JV12-1 (preflight de typecheck/lint compartilhados antes da chamada Bia; erro impede gasto e preserva testes), JV12-2 (`feature --stage recheck-tests` valida arquivos/cenários e todos os checks sob stub, atualiza SHA sem chamar Bia), JV12-3 (orientação curta sobre tipos do contrato e diagnósticos no prompt de QA). Recusadas: JV12-4, isolamento de checks sem equivalência demonstrada e risco de esconder erros; JV12-5, stub marcado já implementado/auditado na v11. Arquivos alterados: tools/alice-harness/{feature.py,alice.py,roles/qa.md,README.md,tests/test_feature_orchestrator.py} e docs/agents/orquestracao.md. Travas aplicadas: nenhuma; nenhum orçamento ou cota alterado. Suíte de referência 260 verde; regressões antes da correção JV12-1: 262 vermelho (2 falhas), JV12-2: 264 vermelho (2 erros), JV12-3: 265 vermelho (1 falha); após cada evolução: 262, 264 e 265 testes verdes, respectivamente. Desvio: preflight limitado a comandos de pacote pnpm --filter <pacote> typecheck/lint; não restringe checks finais nem comprova F02 verde no produto. Não foram executadas chamadas Bia nem mudanças em produto/estado de features reais. Perguntas ao Joel: nenhuma. Confirmação final, commit e integração dependem do runner.

## Custo da execução do Jorge (runner)

| Medida | Valor |
|---|---:|
| Modelo(s) | gpt-6-sol |
| Requisições | 35 (falhas re-tentadas: 0, sem usage: 0) |
| Tokens de entrada | 440551 |
| Entrada em cache | 2470221 |
| Tokens de saída | 11608 |
| Raciocínio (já na saída) | 0 |
| Créditos Abacus | 1994.19 |
| Passos análise / aplicação | 9 / 26 |
| Suítes rodadas | 6 |
| Início / fim | 2026-11-17T00:05:18-03:00 / 2026-11-17T00:07:47-03:00 |
