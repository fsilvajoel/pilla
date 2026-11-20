# harness-v10 — quadro-fotografia da leva

## Identificação

- **Versão:** harness-v10
- **Data:** 2026-11-16T23:23:17-03:00 (recebida; relógio da análise não aferido)
- **Execução:** Review harness-v10; ID adicional não fornecido.
- **Estado da versão:** proposta.
- **Escopo recebido:** decisão do Joel de 16/11 sobre JV9-3: fotografia manual, comandos `leva`, `fila`, `quadro`, dados estruturados/atômicos, ≤~40 linhas, quota via OpenRouter, `?` por fonte falha, sem alteração automática/núcleo; testes isolados da rede e documentação. Análise ≤40 passos, aplicação ≤60, leitura ≤400 linhas, teto 3000 créditos.
- **Fontes recebidas:** pedido atual; `tools/jorge/logs/harness-v9/relatorio.md:16-75,113-128` e `harness-v8/relatorio.md:68-77,120-124`; nenhuma retro indicada; consultada `tools/alice-harness/runs/retro-20261116-181140.md`; código e docs citados.
- **Base git:** `c754a376d1020211f776653637aad283f72fb544` (`docs/mvp-planning`); worktree `jorge/harness-v10` informado.
- **Workspace inicial:** isolado informado; limpeza não aferível pelas ferramentas de leitura.
- **Modelo/provedor efetivamente utilizados:** `gpt-6-sol` informado; metadados efetivos da API indisponíveis nesta fase.
- **Autorizações de Joel:** decisão explícita por fotografia manual, escritas do Claude em leva/fila e geração; nenhuma para núcleo, `runs/**`, `docs/plano/**`, `.env` ou aumento de cota.
- **Suíte de referência:** VERDE, 245 testes, `python3 -m unittest discover -s tests` em `tools/alice-harness`, informada pelo runner; outras contagens não discriminadas.

## Diagnóstico

### Fatos confirmados
- JV9-3 foi adiada até a escolha entre fotografia e atualização automática (`harness-v9/relatorio.md:59-75,124-128`). O Joel resolveu essa condição neste escopo: fotografia explicitamente gerada.
- `alice.py:1483-1541` não tem `leva`, `fila` nem `quadro`; `docs/agents/` ainda não possui `quadro.md`; `README.md:5-15` não os documenta. `runs/retro-20261116-181140.md:3-5` dá `review: ready` e quota pontual, sem fila ou leva confiável.
- `bia.py:63-86` já consulta `/api/v1/key` e obtém `free_model_daily_requests.remaining`; ausência de credencial produz `SystemExit`, falha de consulta `{}`. Reutilizar sem inventar quota; não expor chave. `tools/jorge/nucleo/runner.py:165-173,903-910` persiste `logs/harness-vN/estado.json` com `status` e imprime `JORGE_STATUS=<status> versao=<v>`; leitura permitida, escrita no núcleo/logs proibida. `tools/jorge/README.md:16-25` define estados.
- `feature.py:94-115` e `alice.py:1286-1288,1383-1402` também usam quota; quadro não deve substituí-la como portão de Bia. `alice.py:192-216` já impede cobertura `0/0` num check; gerar quadro não altera esse portão.
- `metricas(metrics)`: 29 execuções, 18 done (62,1%), 1,97 tentativas e 196,5 s em média; `metricas(evolution)` agrupa versões por hash, não quantifica economia de ler quadro.

### Causas e hipóteses
- **Confirmada:** ausência de interface de registro estruturado da decisão do Claude (leva/filas) e de gerador explícito; retro e estado de feature não substituem fila (`alice.py:1483-1541`, retro citada).
- **Não confirmada:** a frequência com que agentes leem logs ou esquecerão de regenerar o quadro; não inferir frescor de eventos externos. Último status só é conhecido se um estado de runner terminado contiver campo `status` correspondente ao contrato `JORGE_STATUS`; sem ele, `?`.

### Justificativa econômica
- Um gerador manual com entradas atômicas e fontes injetáveis tem superfície pequena em comparação com integração automática no núcleo; evita apresentar retrospectivas como fila atual. A consulta à quota pode custar uma chamada HTTP **por geração**, sem consumo de requisição de modelo Bia nos testes; latência e economia de leitura de logs não foram medidas. Não automatizar a geração sem observação de valor. Limitar saída e exibir instante reduz risco de impressão de atualidade falsa; consumidores devem reconhecer que fotografia pode envelhecer.

## Evoluções

| ID | Problema | Evidência — arquivo:linha na base ou retro | Mudança | Arquivos | Teste que prova | Risco | Tipo | Status |
|---|---|---|---|---|---|---|---|---|
| JV10-1 | ausência de entradas autoritativas e quadro manual | `harness-v9/relatorio.md:59-75`; `alice.py:1483-1541`; `bia.py:63-86`; `runner.py:165-173,903-910` | implementar `leva`/`fila` estruturados e atômicos e `quadro` datado, compacto, com fontes independentes e `?` em falhas | `tools/alice-harness/{alice.py,quadro.py,tests/test_quadro.py}`, `docs/agents/quadro.md` (gerado) | fixture temporária sem rede: CLI/atômico, filas e status, quota e reset, fontes ausentes/erros isolados, saída curta | médio — dados operacionais e HTTP | correção | adiada — aguardando aplicação |
| JV10-2 | agentes ainda consultariam logs em vez da fotografia | `README.md:5-15`; `docs/agents/orquestracao.md:26-34`; `cartao-de-tarefa.md:98-105` | documentar invocação, semântica da fotografia e leitura do quadro, com ressalva de que retro permanece fonte de auditoria | `tools/alice-harness/README.md`, `docs/agents/{orquestracao.md,cartao-de-tarefa.md}` | teste de documentação e inspeção; suíte ≥245 | baixo — texto | doc | adiada — aguardando aplicação |

### JV10-1 — comandos e fotografia verificável

- **Causa e comportamento atual:** não há comandos ou armazenamento próprios; retro só traz dados de execução encerrada, quota instantânea e não fila.
- **Comportamento pretendido:** `alice.py leva <texto> [--repo <path>]` salva decisão do Claude; `alice.py fila <agente> <itens> [--repo <path>]` salva por agente (`alice`, `bia`, `jorge`); cada alteração substitui JSON estruturado por arquivo temporário no mesmo diretório e `os.replace`, sem edição por string em Markdown. `alice.py quadro [--repo <path>]` lê entradas, estado atual de Alice (lock e cartão, quando verificável), estado `JORGE_STATUS` terminal mais recente do runner, quota via `bia.quota(bia.api_key(repo))`, e renderiza `docs/agents/quadro.md` via substituição atômica; timestamp ISO com fuso no topo, uma linha-resumo para cada agente e filas explicitamente listadas, ≤40 linhas. Aceitar `--repo` para testes temporários, default `.`; usar arquivo estruturado sob `docs/agents/` (não `runs/**` ou `docs/plano/**`). Quando qualquer fonte falta, está malformada ou falha, mostrar `?` **só naquele campo**, nunca converter ausência em fila vazia ou cota zero. Reset informado como `00:00 UTC (21h BRT, UTC−03)`, não calculado do horário local nem apresentado como campo retornado da API.
- **Implementação mínima:** módulo `quadro.py` com persistência/renderização e callbacks injetados para relógio, quota, estado Alice e último estado Jorge; CLI em `alice.py` só delega. Não ler nem escrever `.env` durante esta execução; em uso normal a API existente de Bia resolve credencial, e o teste deve injetar uma função falsa que não a chama. Dados livres devem ser normalizados para uma linha e comprimentos razoáveis, sem interpolação de Markdown cru capaz de acrescentar linhas. Selecionar versão Jorge numericamente por diretório `harness-vN`, **não** por ordenação lexical; ler somente `estado.json` terminal com `status`, convertendo ao prefixo contratual `JORGE_STATUS`; não deduzir sucesso de relatório ou versão isolada. Campo inexistente permanece `?`. Erro de publicação não alegará quadro atualizado.
- **Fora do escopo:** atualizar quadro automaticamente; mexer em núcleo, logs ou estado de feature; tratar quadro como autorização para executar Bia; ler logs completos para inferir fila; mudar teto de cartão, orçamento ou portão de cobertura. Documento gerado não é fonte autoritativa de status futuro.
- **Dependências e ordem:** nenhuma anterior; JV10-2 depende de comandos e formato de JV10-1.
- **Prova de regressão:** novo teste importa CLI/módulo em repositório temporário: antes falha porque comandos não existem; depois persiste leva/filas, troca de fila preserva as outras, `os.replace` via mock verifica atomicidade e falha antes de replace preserva anterior; `quadro` gera caminho correto com hora e offset, três linhas de agentes, quota verdadeira e reset, ≤40 linhas. Testes injetam callbacks sem rede e verificam ausência/erro/malformação individual, fila faltante `?`, status mais recente válido e versão numérica, entrada com newline não injeta linha; CLI rejeita agente desconhecido ou argumento inválido sem sobrescrever dado.
- **Casos negativos/limites:** fonte de quota indisponível `?`, nunca `0` deduzido; erro de lock/estado Jorge isolado; fonte ausente de fila não aparece como `vazia`; exceção de renderização antes de `os.replace` mantém quadro anterior. `0/0` de cobertura não participa e não fica verde por esta evolução (suíte preexistente conserva portão).
- **Compatibilidade:** três subcomandos novos sem alterar os existentes; `--repo` opcional, dados JSON novos em `docs/agents/`, quadro gerado consumido por Claude, Alice e Bia como consulta humana; não inserir quadro inteiro em prompt ou checks de `feature.py`/`bia.py`. Nenhuma configuração nova; credencial usa mecanismo Bia já existente. Custo esperado: uma consulta HTTP `/key` na geração quando configurada, trabalho local pequeno e manutenção manual da fotografia; economia não quantificável.
- **Auditoria:** não aplicável (portão/CLI, não trava). **Autorização:** decisão de Joel informada no pedido JV9-3. **Custo/benefício esperado:** benefício de leitura compacta hipotético; risco principal é obsolescência, mitigada por carimbo e processo manual explícito. **Resultado observado:** pendente. **Motivo do status:** adiada — aguardando aplicação.

### JV10-2 — guia de uso sem prometer atualização automática

- **Causa e comportamento atual:** documentação de comandos não menciona quadro; orientação de fim de leva aponta leitura de retro (`README.md:5-15`, `cartao-de-tarefa.md:98-105`).
- **Comportamento pretendido:** agentes consultam `docs/agents/quadro.md` para estado resumido ao retomar trabalho, em vez de varrer logs; Claude registra mudança com `leva`/`fila` e gera `quadro` explicitamente quando deseja nova fotografia. Retros continuam evidência de auditoria e custos, não são apagadas/substituídas. Data no topo prevalece; não prometer tempo real.
- **Implementação mínima:** parágrafos curtos nos três documentos; o `quadro.md` é saída de JV10-1, não documentação editada manualmente. Preservar instruções de retro/revisão de produto.
- **Fora do escopo:** `AGENTS.md`, `tools/jorge/README.md` (fora da escrita), prompts de produto e criação de timer.
- **Dependências e ordem:** após JV10-1.
- **Prova de regressão:** teste de presença de comandos/documentos e aviso 'fotografia', junto a teste de renderização; suíte completa após cada evolução. Caso negativo: documentação não apresenta atualização automática nem fila ausente como vazia; 0/0 continua reprovado pelos testes atuais.
- **Compatibilidade:** documentação acrescenta comandos e substitui hábito de leitura de logs operacionais; CLI/configuração de comandos preexistentes inalteradas; consumidores humanos Claude/Alice/Bia devem consultar o caminho gerado; custo de manutenção manual, economia não medida.
- **Auditoria:** não aplicável. **Autorização:** pedido atual. **Custo/benefício esperado:** baixo esforço, evita instrução contraditória; sem medição de economia. **Resultado observado:** pendente. **Motivo do status:** adiada — aguardando aplicação.

## O que ficou para Joel decidir

| Decisão | Evolução | Motivo | Opções e recomendação | Bloqueia aplicação? |
|---|---|---|---|---|
| Nenhuma pendente | — | Joel já decidiu fotografia manual para JV9-3 | Implementar sem tocar no núcleo | Não |

Mudanças necessárias fora da lista de escrita: nenhuma; não editar núcleo, `AGENTS.md`, `runs/**` ou estados `docs/plano/**`.

## Execução e suíte

| Momento | Evolução | Resultado | Executados | Falhas | Erros | Ignorados | Evidência |
|---|---|---|---:|---:|---:|---:|---|
| Referência | — | VERDE informado | 245 | 0 (inferido de VERDE) | 0 (inferido de VERDE) | não informado | solicitação do runner |
| Regressão antes da correção | JV10-1/JV10-2 | não executada nesta fase | — | — | — | — | análise somente leitura |
| Após evolução | — | pendente | — | — | — | — | aplicação |
| Final — runner | — | pendente | — | — | — | — | runner |

- **Comando:** `python3 -m unittest discover -s tests`, no diretório do harness.
- **Anomalias de descoberta/contagem:** nenhuma informada; zero testes não é verde.
- **Tentativas e falhas intermediárias:** nenhuma suíte executada pelo Jorge nesta fase.
- **Desvios do relatório inicial:** nenhum até aqui.
- **Resultado transacional:** pendente do runner; **commit:** pendente do runner.
- **Se não aplicado:** registrar razão e diff preservado pelo runner.
- **Evoluções revertidas:** nenhuma até aqui.

## Custo da execução do Jorge

Dados de API, retries, tokens e créditos preenchidos pelo runner; não inferidos de nome configurado.

| Medida | Valor | Fonte/observação |
|---|---:|---|
| Requisições à API, incluindo retries | indisponível | runner |
| Tokens de entrada | indisponível | usage |
| Tokens de saída | indisponível | usage |
| Tokens totais | indisponível | sem dupla contagem |
| Entrada em cache | indisponível | usage |
| Raciocínio | indisponível | indicar inclusão na saída pelo runner |
| Custo monetário | indisponível | runner/preços |
| Chamadas de ferramentas / suítes | indisponível / 0 nesta análise | runner |
| Duração total | indisponível | runner |

- **Cobertura da medição:** parcial, aguardando runner.
- **Estimativas separadas dos valores medidos:** apenas custo qualitativo de uma consulta de quota por geração; sem preço inferido.
- **Consumo de Bia:** nenhum pelo Review; teste sem rede.
- **Conclusão:** custo/benefício da fotografia dependerá de uso observado; não declarar economia realizada.


---
## Verificação do runner
- Status: **aplicada**
- Base: `c754a376d1020211f776653637aad283f72fb544`
- Suíte final: VERDE, 252 testes (referência 245)
- Arquivos alterados: docs/agents/cartao-de-tarefa.md, docs/agents/orquestracao.md, tools/alice-harness/README.md, tools/alice-harness/alice.py, tools/alice-harness/quadro.py, tools/alice-harness/tests/test_quadro.py
- Rodadas de reparo usadas: 0
- Revertidos só estes (invariante): nenhum
- Travas (commit separado `Trava: sim`, auditoria do Joel): nenhuma
- Problemas: nenhum

## Resumo do finish
Implementadas candidatas JV10-1 (leva/fila em JSON atômico; quadro-fotografia manual, datado, fonte de quota OpenRouter reutilizada, estado de Alice e último JORGE_STATUS, falhas isoladas como ?; testes sem rede) e JV10-2 (README e docs/agents explicam comandos, caráter manual e leitura do quadro em vez dos logs; retros permanecem evidência). Adiadas/recusadas: nenhuma. Arquivos alterados: tools/alice-harness/{alice.py,quadro.py,README.md,tests/test_quadro.py}; docs/agents/{orquestracao.md,cartao-de-tarefa.md}. Travas aplicadas: nenhuma. Suíte referência 245 verde; regressão antes da implementação 246 vermelho (módulo ausente); após JV10-1: 251 vermelho (duas linhas por agente), corrigido para 251 verde; após JV10-2: 252 vermelho (README não continha expressão testada 'fotografia manual'), corrigido para 252 verde. Nenhum teste real de rede nem Bia chamada. Desvios: docs/agents/quadro.md não foi gravado durante Review, pois geração real consultaria API/estado operacional e criaria fotografia com data/cota não verificadas; comando o cria sob solicitação do Claude. Documentação explicita isso. Nenhuma pergunta ao Joel; decisão fotografia já recebida. Nenhum commit ou aplicação final alegados; runner validará.

## Custo da execução do Jorge (runner)

| Medida | Valor |
|---|---:|
| Modelo(s) | gpt-6-sol |
| Requisições | 23 (falhas re-tentadas: 0, sem usage: 0) |
| Tokens de entrada | 262218 |
| Entrada em cache | 1144043 |
| Tokens de saída | 9964 |
| Raciocínio (já na saída) | 0 |
| Créditos Abacus | 1248.05 |
| Passos análise / aplicação | 6 / 17 |
| Suítes rodadas | 5 |
| Início / fim | 2026-11-16T23:23:17-03:00 / 2026-11-16T23:25:11-03:00 |
