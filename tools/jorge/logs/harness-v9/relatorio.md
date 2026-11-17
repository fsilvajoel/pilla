# harness-v9 — custo com fuso, textos coerentes e contrato do quadro

## Identificação
- **Versão:** harness-v9
- **Data:** 2026-11-16T23:19:58-03:00 (recebida; horário da análise não aferido)
- **Execução:** Review harness-v9; ID adicional não fornecido
- **Estado da versão:** proposta
- **Escopo recebido:** JV8-5, JV8-6 e quadro JV7-7; análise ≤40 passos, aplicação ≤60, leitura ≤400 linhas, teto 3000 créditos.
- **Fontes recebidas:** solicitação atual; `tools/jorge/logs/harness-v8/relatorio.md:16-75,120-139`; `tools/alice-harness/runs/retro-20261116-181140.md`; código e testes citados abaixo; nenhuma retro indicada expressamente.
- **Base git:** `85985a13f120c18a97f87c94330fed4063be2a15` (`docs/mvp-planning`), worktree informado `jorge/harness-v9`.
- **Workspace inicial:** worktree isolado informado; limpeza não aferível pelas ferramentas.
- **Modelo/provedor efetivamente utilizados:** `gpt-6-sol` informado; metadados de API/provedor não disponibilizados.
- **Autorizações de Joel:** pedido atual para JV8-5/6 e quadro; nenhuma autorização para núcleo, `docs/plano/**`, `.env` real ou aumento de cota.
- **Suíte de referência:** VERDE, 242 testes, `python3 -m unittest discover -s tests` em `tools/alice-harness`, informada pelo runner; falhas/erros/ignorados não detalhados.

## Diagnóstico
### Fatos confirmados
- `claude_usage.py:82-97` procura `-S 'id: <ID>'` no histórico de `docs/plano`, sem reconhecer outras sintaxes YAML; `:37-44` compara strings de horários em vez de instantes. `alice.py:1194-1220,1482-1500` usa ambas as funções em `cost` e `claude-usage`. `tests/test_claude_usage.py:14-24` cobre somente timestamps sem offset.
- `README.md:35` anuncia 150 linhas, enquanto `alice.py:124-144` e `cards.py:217-233` derivam limites do perfil e cartão. `README.md:68` diz padrão gemma; `alice.py:70-87` carrega `models.yaml:default`. `bia.py:20-24` descreve Alice como autora de testes no fluxo econômico, ao contrário de `docs/agents/orquestracao.md:20-32`. `jorge/agente/jorge.md:5` cita timer diário. `.env.example:1-11` não lista Abacus e contém uma única linha Brave; `bia.py:77-85` requer OPEN_ROUTER_API_KEY.
- v8 adiou o quadro por falta de contrato de entrada (`logs/harness-v8/relatorio.md:68-75,120-124`); o pedido atual nomeia Claude escritor de leva/fila, mas não especifica garantia de atualização de outras transições. `feature.py:190-203,645-669` altera estado diretamente, `nucleo/runner.py:506-581` observa feature/retros/caixa mas não evento de leva. `runs/retro-20261116-181140.md:3-5` contém `review: ready` e cota registrada, não uma fila autoritativa. Nenhum `quadro`/`leva`/`fila` existe no parser `alice.py:1472-1533`.
- `metricas(metrics)`: 29 runs, 18 done (62,1%), média 1,97 tentativas e 196,5 s; `metricas(evolution)` separa versões por hash, não atribui economia a estas correções.

### Causas e hipóteses
- **Confirmadas:** busca literal dependente de formatação, janelas lexicográficas, documentação legada, ausência do CLI/contrato do quadro.
- **Não confirmadas:** ocorrência/frequência de custo faltante por sintaxe real dos cartões; evento de atualização automática após cada mudança de fila/estado ou da caixa; esquema de gravação do último status Jorge; custo de API para consultar cota. Não deduzir dado de `runs/` que não o registra.

### Justificativa econômica
- JV9-1 corrige atribuição potencialmente errada de custos com teste git temporário e parsing local, sem rede nem medição de economia realizada; médio risco de falsos positivos em YAML/histórico. JV9-2 é ajuste textual de baixo custo, evita operar pelo número/atribuição errados. Quadro autoritativo desatualizado custa mais que um `?`: especificar evento antes de implantar nova fonte mutável; pedido de decisão ao Joel registrado. Nenhuma economia monetária estimável a partir das métricas fornecidas.

## Evoluções
| ID | Problema | Evidência — arquivo:linha na base ou retro | Mudança | Arquivos | Teste que prova | Risco | Tipo | Status |
|---|---|---|---|---|---|---|---|---|
| JV9-1 | início de cartão e janelas temporais errados | `claude_usage.py:37-44,82-97`; `alice.py:1194-1220` | localizar primeiro commit introduzindo ID de cartão independentemente de formatação YAML, usar instante UTC para ambos os comandos, falhar fechado para IDs sem início em vez de contabilizar desde sempre | `tools/alice-harness/{claude_usage.py,alice.py,tests/test_claude_usage.py,README.md}` | git temporário com formatos YAML distintos, ID prefixo/ausente; offsets +03/-03 nos limites, 0/0 irrelevante | médio — custo e histórico | correção | adiada — aguardando aplicação |
| JV9-2 | documentação/prompt/env contraditórios | `README.md:35,68`; `bia.py:20-24`; `.env.example:8-11`; `jorge/agente/jorge.md:5` | trocar número por fonte `cards.size_model`, corrigir papéis e padrão YAML, retirar timer do prompt editável, adicionar comentário Abacus e indicação OpenRouter no exemplo, Brave só ali como orientação de configuração | `tools/alice-harness/{README.md,bia.py,.env.example,tests/test_profiles.py}`, `tools/jorge/agente/jorge.md`; docs/agents só onde houver contradição vigente | teste textual comprova ausência do número fixo/papel/timer, exemplo sem segredo, regressões de tamanho existentes, suíte ≥242 | baixo — texto, prompt próprio | doc/agente | adiada — aguardando aplicação |
| JV9-3 | quadro compartilhado não possui atualização autoritativa | pedido JV7-7; `logs/harness-v8/relatorio.md:68-75`; `alice.py:1472-1533`; `feature.py:190-203`; `nucleo/runner.py:563-581` | aguardar escolha de quadro-fotografia explícita versus atualização automática; não gerar quadro com filas presumidas | futuros `tools/alice-harness/{alice.py,quadro.py,tests/test_quadro.py}`, `docs/agents/quadro.md`; integração núcleo depende de Joel | futuro: leva/fila gravadas e lidas, `?` por fonte falha, cota Bia sem rede em testes, ≤~40 linhas; transição não deixa verde falso | alto — obsolescência e custo de rede | correção/doc | adiada — aguardando Joel |

### JV9-1 — custo Claude verificável
- **Causa e comportamento atual:** `-S` literal erra formatos e `window` compara offsets lexicalmente. `card_cost` usa `card_since(...) or ''` (`alice.py:1194-1198`): ID não localizado atribui todas as sessões, falso custo.
- **Comportamento pretendido:** encontrar primeiro acréscimo do ID como campo de cartão em YAML versionado `docs/plano`, não substring de outro ID, usando commit pai como início; limites `--since`/`--until` e timestamps com offset interpretados em UTC; sem início e sem `--since` explícito não atribuir custo a cartões.
- **Implementação mínima:** examinar diffs/versões de arquivos YAML do plano com parsing de cartões e fronteira de ID, primeiro commit introdutor; manter API de `window`/`card_since`, normalizar UTC e preservar limites inclusivo/exclusivo. Tratar ausência e erros git sem alegar zero real: retorno CLI não-zero ou marcador desconhecido, nunca total desde sempre.
- **Fora do escopo:** inventar início de cartão não versionado, estimar tokens ausentes, refazer pesos ou ler `.env`.
- **Dependências e ordem:** nenhuma; aplicar antes da documentação de `cost` em JV9-2.
- **Prova de regressão:** fixture com repositório git, commits pai/introdução para `id: E9-T01`, `id : 'E9-T02'` e outro layout YAML; primeiro commit correto; ausente e ID prefixo não têm início. Teste de `window` mostra classificação errada antes e correta depois para row +03 e filtro -03, inclusive igualdade em `until` excluída e ISO UTC original.
- **Casos negativos/limites:** ID ambíguo/ausente, git falho, timestamps inválidos e sem offset (compatível com timestamps antigos UTC); 0/0 não é aplicável e jamais deve ser convertido em sucesso por esta mudança.
- **Compatibilidade:** CLI de `cost`/`claude-usage` conserva argumentos e formato de totais; `--since/--until` passam a aceitar fuso, falta de cartão passa a falhar fechada; nenhum parâmetro de configuração novo. Consumidores retro de `plan-run` precisam tratar desconhecido sem quebrar entrega; custo adicional: leitura do histórico git por ID, não aferido.
- **Auditoria:** não aplicável. **Autorização:** pedido JV8-5. **Custo/benefício esperado:** integridade da métrica; magnitude não estimável. **Resultado observado:** pendente. **Motivo do status:** aguardando aplicação.

### JV9-2 — textos com fonte única
- **Causa e comportamento atual:** textos não foram atualizados com mudanças já presentes em `alice.py`, `cards.py` e orquestração; prompt próprio afirma gatilho desabilitado.
- **Comportamento pretendido:** documentação operacional referencia fonte do limite e do perfil, Bia autora dos testes da feature, Jorge no fim da leva; variáveis documentadas sem segredo.
- **Implementação mínima:** correções pontuais nos arquivos listados; manter uma definição operacional para Brave em `.env.example`, referência do README para o exemplo sem repetir instruções. Não transformar descrição histórica `alice.py:140-144` em limite fixo.
- **Fora do escopo:** notas históricas, `tools/jorge/nucleo/padrao/jorge.md` (proibido), `.env` real, mudanças de comportamento do modelo/Bia.
- **Dependências e ordem:** após JV9-1 para texto `cost`; JV8-1/2/3 já presentes na base.
- **Prova de regressão:** teste de conteúdo e inspeção: README não traz limite fixo nem gemma como padrão; docstring da Bia diferencia `test-author` legado e testes da feature; prompt sem timer diário; `.env.example` contém exemplo comentado `ABACUSAI_API_KEY` sem valor real e uma ocorrência de configuração Brave; suíte ≥242.
- **Casos negativos/limites:** não escrever segredo; manter instrução existente de perfil explícito sem prometer API de cota sempre acessível; não reduzir portões nem permitir 0/0.
- **Compatibilidade:** CLI/config inalteradas; consumidores humanos recebem fonte real `cards.size_model`; custo apenas manutenção documental, benefício não medido.
- **Auditoria:** não aplicável. **Autorização:** pedido JV8-6. **Custo/benefício esperado:** correção pequena de instruções contraditórias, economia não estimável. **Resultado observado:** pendente. **Motivo do status:** aguardando aplicação.

### JV9-3 — quadro e frescor
- **Causa e comportamento atual:** não existe entrada estruturada para leva/filas nem comando; novo pedido esclarece escritor Claude mas não assegura atualização de transições externas. `estado.json` é apenas legível nesta execução; núcleo e caixa têm suas próprias rotas.
- **Comportamento pretendido:** quadro legível de até ~40 linhas com uma linha por agente e leva/filas autoritativas, cota Bia restante e reset 21h BRT, status Jorge, falha individual como `?`; identidade/frescor verificáveis, não documento decorativo que possa enganar agentes.
- **Implementação mínima:** após decisão de Joel, contrato de `alice.py leva`, `alice.py fila`, `alice.py quadro`; gravação estruturada/atômica das entradas Claude e geração marcada com tempo; integração de leitores e atualização nos escritores de estado e no núcleo somente por Joel se atualização automática for exigida.
- **Fora do escopo:** alterar `docs/plano/**`, `tools/jorge/nucleo/**`, `runs/**`; gasto real de API Bia em teste; inferir fila a partir de retro.
- **Dependências e ordem:** decisão do Joel sobre fotografia/manual versus promessa de atualização em cada transição, inclusive núcleo. Independente de JV9-1/2.
- **Prova de regressão:** testes com fontes temporárias injetadas e sem rede: perda isolada de estado, runs, API da Bia ou caixa produz `?`; alteração de leva/fila publicada aparece; saída ≤~40 linhas; teste de transição detecta quadro stale quando contrato exige atualização; 0/0 não é relevante/nunca verde em checks de revisão.
- **Casos negativos/limites:** cota não consultável `?`, fila ausente `?` e não 'vazia', carimbo temporal de fotografia; reset só se houver semântica documentada.
- **Compatibilidade:** CLI `leva/fila/quadro` novos, novo registro estruturado e consumidor Claude/Alice/Bia; se integração automática, exige mudança de núcleo fora da autorização deste Review. Custo periódico de consulta de API e gravações ainda não medido.
- **Auditoria:** não aplicável. **Autorização:** pedido JV7-7; decisão de frescor pendente. **Custo/benefício esperado:** menos leitura de logs apenas hipótese; risco de informação stale impede implementação até decisão. **Resultado observado:** pendente. **Motivo do status:** adiada — aguardando Joel; `perguntar_joel` registrado.

## O que ficou para Joel decidir
| Decisão | Evolução | Motivo | Opções e recomendação | Bloqueia aplicação? |
|---|---|---|---|---|
| Fotografia explícita versus atualização automática para `quadro` | JV9-3 | ausência de evento de leva no núcleo e de hook de atualização externa (`nucleo/runner.py:563-581`) | A) fotografia manual datada com `?` por falha (recomendado como etapa econômica inicial); B) atualização automática, Joel define evento estruturado e altera núcleo | sim, só JV9-3 |

Mudanças no núcleo necessárias para opção B não são autorizadas por este relatório.

## Execução e suíte
| Momento | Evolução | Resultado | Executados | Falhas | Erros | Ignorados | Evidência |
|---|---|---|---:|---:|---:|---:|---|
| Referência | — | VERDE (informado) | 242 | 0 (informado como verde) | 0 (informado como verde) | não detalhados | solicitação do runner |
| Regressão antes da correção | JV9-1/JV9-2 | não executada nesta fase | — | — | — | — | análise só leitura |
| Após evolução | — | pendente | — | — | — | — | aplicação |
| Final — runner | — | pendente | — | — | — | — | runner |

- **Comando:** `python3 -m unittest discover -s tests`, no diretório do harness.
- **Anomalias de descoberta/contagem:** nenhuma informada; zero testes não é verde.
- **Tentativas e falhas intermediárias:** nenhuma suíte executada nesta fase.
- **Desvios do relatório inicial:** nenhum nesta fase.
- **Resultado transacional:** pendente do runner.
- **Commit:** pendente do runner.
- **Se não aplicado:** registrar motivo e diff preservado pelo runner.
- **Evoluções revertidas:** nenhuma nesta fase.

## Custo da execução do Jorge
Dados de API, retries, uso e custos serão preenchidos pelo runner; não inferidos do nome do modelo.
| Medida | Valor | Fonte/observação |
|---|---:|---|
| Requisições à API, incluindo retries | indisponível | runner |
| Tokens de entrada | indisponível | usage |
| Tokens de saída | indisponível | usage |
| Tokens totais | indisponível | sem dupla contagem |
| Entrada em cache | indisponível | usage |
| Raciocínio | indisponível | usage |
| Custo monetário | indisponível | runner |
| Chamadas de ferramentas / suítes | indisponível / 0 nesta fase | runner |
| Duração total | indisponível | runner |

- **Cobertura da medição:** parcial até dados do runner.
- **Estimativas separadas dos valores medidos:** não há estimativa monetária.
- **Consumo de Bia:** nenhum pelo Review.
- **Conclusão:** priorizar integridade de medição e correção textual; não declarar economia realizada; quadro aguarda decisão sobre frescor.

---
## Verificação do runner
- Status: **aplicada**
- Base: `85985a13f120c18a97f87c94330fed4063be2a15`
- Suíte final: VERDE, 245 testes (referência 242)
- Arquivos alterados: tools/alice-harness/.env.example, tools/alice-harness/README.md, tools/alice-harness/alice.py, tools/alice-harness/bia.py, tools/alice-harness/claude_usage.py, tools/alice-harness/tests/test_claude_usage.py, tools/alice-harness/tests/test_profiles.py, tools/jorge/agente/jorge.md
- Rodadas de reparo usadas: 0
- Revertidos só estes (invariante): nenhum
- Travas (commit separado `Trava: sim`, auditoria do Joel): nenhuma
- Problemas: nenhum

## Perguntas ao Joel (não bloquearam o Review)
- **JV9-3**: O quadro gerado sob comando manual `alice.py quadro` deve ser considerado fotografia (data de geração visível e `?` quando fontes indisponíveis) ou exige atualização automática a cada alteração de estado/fila, incluindo alterações do núcleo fora do escopo? Recomendo fotografia explícita por enquanto; caso exija atualização automática, indique o evento estruturado do núcleo.

## Resumo do finish
Candidatas implementadas: JV9-1 (busca estrutural de IDs de cartões nos YAML versionados, início pelo commit pai, janelas ISO normalizadas a UTC; cartão sem início exige --since e retro indica '?') e JV9-2 (README aponta cards.size_model e models.yaml:default, docstring Bia corrige papéis, prompt editável Jorge não menciona timer, .env.example documenta chaves Abacus/OpenRouter sem valores reais e Brave uma vez). JV9-3 adiada — aguardando Joel decidir se quadro é fotografia manual datada ou atualização automática, inclusive transições do núcleo fora da escrita autorizada; pergunta registrada, não foi criado quadro enganoso. Arquivos alterados: tools/alice-harness/{claude_usage.py,alice.py,README.md,bia.py,.env.example,tests/test_claude_usage.py,tests/test_profiles.py} e tools/jorge/agente/jorge.md. Travas aplicadas: nenhuma. Suíte de referência 242 verde; regressão JV9-1 244 testes vermelho (2 falhas esperadas) e após mudança 244 verde; regressão JV9-2 245 vermelho (1 falha esperada) e após mudança 245 verde. Não executei suíte final do runner nem fiz commit. Desvios: não houve mudança em docs/agents pois não se confirmou contradição atual ali; busca do histórico por commits YAML pode ter custo de I/O não medido. Pergunta ao Joel: fotografia explícita do quadro versus atualização automática com evento estruturado do núcleo. Nenhuma Bia chamada, nenhuma permissão ou orçamento aumentado.

## Custo da execução do Jorge (runner)

| Medida | Valor |
|---|---:|
| Modelo(s) | gpt-6-sol |
| Requisições | 32 (falhas re-tentadas: 0, sem usage: 0) |
| Tokens de entrada | 283092 |
| Entrada em cache | 1543940 |
| Tokens de saída | 10247 |
| Raciocínio (já na saída) | 0 |
| Créditos Abacus | 1337.18 |
| Passos análise / aplicação | 8 / 24 |
| Suítes rodadas | 4 |
| Início / fim | 2026-11-16T23:19:58-03:00 / 2026-11-16T23:22:10-03:00 |
