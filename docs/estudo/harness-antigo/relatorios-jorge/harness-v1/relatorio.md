# harness-v1 — cobertura vazia e testes contra stub

## Identificação

- **Versão:** harness-v1
- **Data:** 2026-11-16T13:12:54-03:00 (data recebida; horário de conclusão não fornecido)
- **Execução:** Review harness-v1 (ID de runner não fornecido)
- **Estado da versão:** proposta
- **Escopo recebido:** Review pós E4-F02; incidentes 1–9; priorizar portões/medições; 40 passos de análise, 60 de aplicação; nenhuma trava aprovada.
- **Fontes recebidas:** `tools/alice-harness/runs/retro-20261116-102951.md`, `tools/alice-harness/runs/retro-20261116-102615.md`, pedido do Review e base do harness.
- **Base git:** bf3f518747ca45c6d4f1fc33249c7953af1bbe95 (informada pelo runner; leitura não verifica SHA).
- **Workspace inicial:** worktree isolado informado; limpeza não verificada por ferramenta disponível.
- **Modelo/provedor efetivamente utilizados:** indisponíveis; `gpt-6-sol` é nome configurado, não metadado de API.
- **Autorizações de Joel:** nenhuma para travas; `travas aprovadas: não`.
- **Suíte de referência:** VERDE, 231 testes, `python3 -m unittest discover -s tests` em `tools/alice-harness`, recebida do runner; data do Review, contagens detalhadas indisponíveis. Não executei suíte na análise.

## Diagnóstico

### Fatos confirmados
- Incidente recebido: vitest exibiu `Unknown% (0/0)` após exclusão do stub e passou verde. Código atual confia no exit code dos checks: `bia.py:128-129`, `feature.py:321-339,412-415,438,506-519`; `alice.py:192-200` devolve exit code puro. Não há rejeição de cobertura vazia nesses consumidores. O texto exato do incidente não está nas duas retros indicadas.
- Retro `retro-20261116-102951.md:26-33`: testes `done`, quatro chamadas da Bia consumidas, quota esgotada; `retro-20261116-102615.md:22-27`: três chamadas e execução falha. `feature.py:321,331` roda testes no worktree vigente, ao contrário de `feature.py:455,382-395`, que usa stub para complemento. O defeito é reproduzível se a implementação já estiver no worktree; não há evidência de quantas das três chamadas foram *exclusivamente* causadas por isso.
- `feature.py:382-395` usa `git checkout HEAD` e restaura apenas texto dos arquivos existentes, com efeitos no índice e sem cobrir implementações ausentes em HEAD: não reutilizar cegamente para a etapa de testes sem corrigir a preservação do índice.
- `bia.py:62-74` consulta `free_model_daily_requests` da API; `feature.py:525-530,565-566` mostra `remaining` retornado. As retros `:32-33` e `:26-27` mostram 15/16 restantes, mas não fornecem a resposta da API para provar erro aritmético. `bia.py:98-103` soma tokens apenas quando há `choices`, e `feature.py:230-233` registra só respostas bem-sucedidas; retrospectivas `:12,18` com `0/0` são rodadas Alice, não comprovam consumo Bia omitido.

### Causas e hipóteses
- **Confirmada:** não há verificação mecânica de `0/0` nas saídas de checks; etapa de testes não isola o stub quando existe implementação anterior.
- **Não confirmada:** formato exato de todos os relatórios vitest usados em produção, contador de cota do provedor, tokens ausentes em respostas de erro, situação de migrações `db:regen` e ganho líquido das demais propostas; carecem de evidência para automação neste ciclo.

### Justificativa econômica
- Uma única cobertura vazia pode aprovar entrega não testada; verificação central é pequena e vale antes de novas features. Falha de stub pode causar reparos inúteis e consumo de requisições: as retros mostram orçamento 4/4 esgotado, sem estabelecer causalidade completa. Custo esperado: poucas linhas e testes isolados, nenhuma API paga no Review; economia futura não mensurada.
- Alterações de orçamento/segurança têm alto risco e não têm aprovação. Melhor propor a Joel do que simular aprovação ou fazer uma automação parcial que possa ser burlada.

## Evoluções

| ID | Problema | Evidência — arquivo:linha na base ou retro | Mudança | Arquivos | Teste que prova | Risco | Tipo | Status |
|---|---|---|---|---|---|---|---|---|
| JV1-1 | cobertura `0/0` aprovada | incidente recebido; `bia.py:128-129`, `feature.py:321-339`, `alice.py:192-200` | rejeitar cobertura sem arquivos via normalização central dos resultados de check | `tools/alice-harness/alice.py`, `tools/alice-harness/tests/test_test_guardrails.py` | saída `Unknown% (0/0)` + exit 0 vira falha; cobertura não vazia e checks normais preservados | médio: formato de vitest e consumidores | correção / trava — auditoria do Joel | adiada — aguardando Joel |
| JV1-2 | checks da etapa tests contra implementação prévia | `feature.py:321,331,382-395`; retros indicadas | executar ambos os lotes de checks com implementações temporariamente no stub de HEAD, preservando worktree e índice; falha de isolamento bloqueia | `tools/alice-harness/feature.py`, `tools/alice-harness/tests/test_feature_orchestrator.py` | implementação prévia reprova expect-red antes, passa após; implementação/índice restaurados também em falha | médio: operações git nos arquivos de produto durante execução | correção | adiada — aguardando aplicação |
| JV1-3 | orçamento Bia modificável pelo estado/plano | incidente erro 16 recebido; `feature.py:204-224`; `cards.py:393,443-445` | proposta I–L: ledger append-only fora do estado, teto 3, parada e liberação exclusiva por Joel, commit separado | `tools/alice-harness/cards.py`, `tools/alice-harness/feature.py`, `tools/alice-harness/bia.py`, `tools/alice-harness/tests/` (desenho ainda pendente) | adulterar estado/plano não libera chamada; sem liberação bloqueia; com liberação válida apenas no limite autorizado | alto: segurança e governança | trava — auditoria do Joel | adiada — aguardando Joel |
| JV1-4 | outros pedidos: resume por ID, estado stale, cota/tokens, relatório automático, exemplo Abacus, migrações | pedido recebido; `alice.py:1373-1389,1456`, `feature.py:195-199,525-531`, retros indicadas | não automatizar neste ciclo; medir e especificar separadamente | nenhum neste Review | testes a definir após evidência e delimitação | médio: superfície e incerteza | simplificação/métrica | adiada — aguardando aplicação futura |

### JV1-1 — não aprovar cobertura vazia

- **Causa e comportamento atual:** checks são aceitos por exit 0 mesmo quando o vitest não mede arquivo algum; passes de `feature.py` e `bia.py` dependem de `run_cmd`.
- **Comportamento pretendido:** quando um check de cobertura retorna `Unknown% (0/0)`/total zero, deve haver exit não zero antes que qualquer consumidor o interprete como verde; ausência de prova positiva deve ser tratada explicitamente na implementação se a saída real demonstrar outro formato.
- **Implementação mínima:** normalizar apenas resultado de check de cobertura no caminho comum `alice.run_cmd`, sem alteração de comandos/cards; confirmar formato com teste de regressão. Se não for possível provar cobertura positiva e vazia de forma confiável, parar e reportar.
- **Fora do escopo:** mudar vitest, configurações do produto ou `guard_hook`.
- **Dependências e ordem:** independente; aguarda autorização de trava.
- **Prova de regressão:** dublar `subprocess.run` e fornecer exit 0 + `Unknown% (0/0)` no check de cobertura, confirmar código não zero; saída com cobertura efetiva e comando comum preservam código original; check com erro não fica verde.
- **Casos negativos/limites:** saída vazia, check não cobertura, 0/0 em outros consumidores; confirmar se formato distinto exige extensão antes de aplicar.
- **Compatibilidade:** CLI/config inalteradas; consumidores de `run_cmd` recebem não zero quando cobertura é vazia; custo constante de inspeção de saída.
- **Auditoria:** trava — auditoria do Joel.
- **Autorização:** pendente; **não escrever** até runner declarar `travas aprovadas: sim`.
- **Custo/benefício esperado:** inspeção barata comparada a falso verde; benefício não quantificado.
- **Resultado observado:** somente análise; sem aplicação.
- **Motivo do status:** adiada — aguardando Joel.

### JV1-2 — testar com stub e restaurar implementação

- **Causa e comportamento atual:** `stage_tests` executa `test_checks()` duas vezes sem isolamento, embora `complement` tenha um isolamento parcial.
- **Comportamento pretendido:** checks da Bia na etapa tests veem o stub da base, independentemente da implementação no worktree; saída da etapa preserva implementação e índice; erro de git bloqueia, não aprova.
- **Implementação mínima:** contexto temporário em `feature.py` para checks da etapa (ambos), usando versão HEAD para os arquivos de implementação e restaurando conteúdo e índice no `finally`; validar previamente que HEAD é stub quando aplicável, sem escrever fora dos arquivos permitidos pelo Jorge (a execução futura do harness opera no repo da feature). Evitar reescrever `with_stub` de complemento sem teste específico; se preservar estado git com segurança exigir redesign, parar e reportar.
- **Fora do escopo:** alteração de stub, do produto, do orçamento ou do fluxo de auditoria.
- **Dependências e ordem:** independente de JV1-1; só implementar se for comprovada restauração segura.
- **Prova de regressão:** fixture git de `test_feature_orchestrator.py` com implementação prévia e stub no HEAD: etapa tests `done` com uma requisição e zero reparos, worktree e índice idênticos aos anteriores; caso qualidade `bad` reprova no primeiro lote e conserta no segundo ainda contra stub. Erro de git não devolve `done`.
- **Casos negativos/limites:** arquivo inexistente em HEAD, arquivos staged, falha de checkout, exceção durante check; não perder alterações. Na base atual o fake de `restore` é no-op.
- **Compatibilidade:** CLI e config inalteradas; consumidor `stage_tests` passa a verificar TDD corretamente; não deve mudar semântica de `audit` nem `complement`; economia potencial de reparos/chamadas, não medida.
- **Auditoria:** não aplicável enquanto correção isolada não mudar política/trava; se o runner classificar portão TDD como trava, adiar para Joel.
- **Autorização:** escopo do Review, aguardando transição explícita à aplicação.
- **Custo/benefício esperado:** teste git e pequena mudança; um incidente com quatro chamadas sugere prioridade, mas economia de três chamadas é alegação recebida, não ganho medido.
- **Resultado observado:** somente análise; sem aplicação.
- **Motivo do status:** adiada — aguardando aplicação.

### JV1-3 — orçamento e governança

- **Causa e comportamento atual:** orçamento lido do plano e contagem do estado editável; `cards.py:393` permite 2–6; incidente relata `biaBudget` e `estado.json` alterados.
- **Comportamento pretendido:** I–L somente após Joel definir armazenamento, autorização, invariantes e auditoria.
- **Implementação mínima:** proposta indivisível de ledger autoritativo append-only, teto 3, liberação de Joel verificável e commit isolado; registrar threat model e testes contra edição de estado e retries reais antes da aplicação.
- **Fora do escopo:** alterar `estado.json` ou elevar verba para passar.
- **Dependências e ordem:** decisão explícita de Joel e commit separado pelo runner, que decide o commit.
- **Prova de regressão:** plano `biaBudget=4` rejeitado, estado forjado não reduz ledger, erro/retry consome orçamento, sem liberação não chama API; liberação autêntica permite apenas escopo autorizado.
- **Casos negativos/limites:** arquivo liberador falsificável no mesmo worktree não é autoridade independente; falha de persistência deve bloquear; 0/0 não aplicável.
- **Compatibilidade:** quebra de config (`biaBudget` 4–6), migração dos planos existentes a decidir; CLI a especificar, consumidores feature e bia; custo I/O e desenho de autoridade não estimados.
- **Auditoria:** trava — auditoria do Joel.
- **Autorização:** ausente (`travas aprovadas: não`).
- **Custo/benefício esperado:** evita ultrapassagem de orçamento, mas implementação mal desenhada cria falsa segurança; adiar.
- **Resultado observado:** somente análise.
- **Motivo do status:** adiada — aguardando Joel.

### JV1-4 — fila residual

- **Causa e comportamento atual:** `resume` recebe caminho, não ID (`alice.py:1373,1456`); `finish` mistura extras e estado prévio (`feature.py:195-199`); cota depende de API externa, relatório final já inclui Alice/Bia (`feature.py:525-531`) e `claude_usage.py` precisa avaliação. `.env.example` foi bloqueado pela ferramenta de leitura por regra `.env`; não inspecionar nem editar sem esclarecimento seguro. `plan-run` explicitamente não commita (`alice.py:1352-1354`), mas migração não foi reproduzida.
- **Comportamento pretendido:** revisão independente após evidência; stale `red/message` não deve persistir entre rodadas; métricas não devem representar desconhecido como zero medido.
- **Implementação mínima:** nenhuma neste ciclo, priorizar repros e testes isolados depois.
- **Fora do escopo:** produto, estados existentes, arquivos `.env` e migrações.
- **Dependências e ordem:** investigação de respostas da API e regras de commit por Joel/runner.
- **Prova de regressão:** antes de propor aplicação, um teste que falhe com a causa em cada item, incluindo falhas negativas.
- **Casos negativos/limites:** quota desconhecida, resposta sem usage, ID ambíguo, estado de etapas omitidas.
- **Compatibilidade:** CLI `resume` teria adição compatível; demais configuração e consumidores precisam especificação; custo não estimável.
- **Auditoria:** não aplicável aos itens documentados; se mexer em política ou orçamento, reclassificar como trava.
- **Autorização:** aguardando Review futuro; `.env.example` requer esclarecer bloqueio de leitura antes de qualquer escrita.
- **Custo/benefício esperado:** não demonstrado; evitar gastar requisições/tempo em automação especulativa.
- **Resultado observado:** somente análise.
- **Motivo do status:** adiada — aguardando aplicação futura, não liberada neste ciclo.

## O que ficou para Joel decidir

| Decisão | Evolução | Motivo | Opções e recomendação | Bloqueia aplicação? |
|---|---|---|---|---|
| Autorizar alteração de portão de cobertura e auditoria | JV1-1 | `travas aprovadas: não` | Aprovar escopo preciso e runner declarar `sim`, ou adiar; recomendo aprovar após verificar formato real da saída | sim |
| Autoridade de ledger e teto de orçamento; commit separado | JV1-3 | erro 16 e veto explícito | Definir mecanismo não forjável pelo agente; aprovar I–L separadamente; recomendar não aplicar parcial | sim |
| Interpretação de `.env.example` bloqueado pela ferramenta | JV1-4 | leitura proibida | Clarificar acesso explicitamente, sem liberar `.env` real; adiar exemplo por ora | sim, só para o exemplo |
| Prioridade dos demais itens com evidências complementares | JV1-4 | incidentes não reproduzidos | Recomendo medir e revisar separadamente | não para JV1-2 |

## Execução e suíte

| Momento | Evolução | Resultado | Executados | Falhas | Erros | Ignorados | Evidência |
|---|---|---|---:|---:|---:|---:|---|
| Referência | — | VERDE informado | 231 | não informado | não informado | não informado | pedido do runner |
| Regressão antes da correção | — | não realizada (análise somente leitura) | — | — | — | — | — |
| Após evolução | — | aguardando aplicação | — | — | — | — | — |
| Final — runner | — | aguardando runner | — | — | — | — | — |

- **Comando:** `python3 -m unittest discover -s tests`, no diretório do harness.
- **Anomalias de descoberta/contagem:** não verificadas; zero testes nunca é verde.
- **Tentativas e falhas intermediárias:** nenhuma nesta análise.
- **Desvios do relatório inicial:** nenhum.
- **Resultado transacional:** sem diff nesta análise; commit/rollback são do runner.
- **Commit:** a preencher pelo runner; nenhum alegado.
- **Se não aplicado:** motivos de autorização e transição acima; diff a cargo do runner.
- **Evoluções revertidas:** nenhuma.

## Custo da execução do Jorge

| Medida | Valor | Fonte/observação |
|---|---:|---|
| Requisições à API, incluindo retries | indisponível | runner |
| Tokens de entrada | indisponível | usage da API não recebido |
| Tokens de saída | indisponível | usage da API não recebido |
| Tokens totais | indisponível | runner, sem dupla contagem |
| Entrada em cache | indisponível | metadados não recebidos |
| Raciocínio | indisponível | metadados não recebidos |
| Custo monetário | indisponível | preço/usage não recebidos |
| Chamadas de ferramentas / suítes | indisponível / 0 na análise | runner consolida chamadas; nenhuma suíte executada |
| Duração total | indisponível | runner |

- **Cobertura da medição:** parcial, somente evidências visíveis; runner preenche API e duração.
- **Estimativas separadas dos valores medidos:** impacto qualitativo; nenhuma economia medida.
- **Consumo de Bia:** nenhum pelo Review.
- **Conclusão:** JV1-2 pode poupar reparos, porém validação transacional é obrigatória; JV1-1 e JV1-3 aguardam autorização. Não declarar economia realizada.


---
## Verificação do runner
- Status: **sem_mudancas**
- Base: `bf3f518747ca45c6d4f1fc33249c7953af1bbe95`
- Suíte final: VERDE, 231 testes (referência 231)
- Arquivos alterados: nenhum
- Problemas: nenhum
- Travas aprovadas: não

## Resumo do finish
Nenhuma evolução implementada. JV1-1 e JV1-3 adiadas — aguardando Joel (travas aprovadas: não). JV1-2 foi bloqueada: tentativa de acrescentar regressão em tools/alice-harness/tests/test_feature_orchestrator.py recebeu «mudança de trava; travas aprovadas: não»; parei sem contornar a restrição. JV1-4 permanece adiada para Review futuro. Arquivos alterados: nenhum (a ferramenta recusou a edição). Testes de aplicação: nenhum executado; referência VERDE de 231 testes foi apenas informada pelo runner, não verificada aqui. Desvio: a classificação de JV1-2 como correção sem auditoria no relatório revelou-se incompatível com o bloqueio mecânico do runner. Decisão mínima: Joel autorizar explicitamente JV1-2 como trava e runner declarar «travas aprovadas: sim» em nova aplicação, ou mantê-la adiada. Custo de API/tokens não fornecido; nenhuma requisição à Bia foi feita.

## Custo da execução do Jorge (runner)

| Medida | Valor |
|---|---:|
| Modelo(s) | gpt-6-sol |
| Requisições | 10 (falhas re-tentadas: 0, sem usage: 0) |
| Tokens de entrada | 140179 |
| Entrada em cache | 263293 |
| Tokens de saída | 5764 |
| Raciocínio (já na saída) | 0 |
| Créditos Abacus | 675.96 |
| Passos análise / aplicação | 6 / 4 |
| Suítes rodadas | 0 |
| Início / fim | 2026-11-16T13:12:54-03:00 / 2026-11-16T13:14:01-03:00 |
