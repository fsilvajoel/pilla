# Ficha de fatos do estudo (fonte para o artigo; tudo aqui pode ser público)

## Contexto e dores
- Projeto de estudo "pilla": sistema de gestão de empréstimos que substitui uma planilha com erros (saldo com sinal manual, renovação duplicada como linha nova, datas em texto livre). Objetivo duplo: o produto e provar arquitetura escalável construída por agentes de IA.
- Dor 1: custo/limite de tokens do Claude em tarefas braçais (tentativa e erro, leitura de arquivos grandes).
- Dor 2: modelo local sozinho inventa API e "faz o teste passar de qualquer jeito".
- Dor 3: contexto inchado (reler documentação inteira a cada tarefa).
- Dor 4: uma pessoa só (o autor) para decidir, revisar e aprovar.

## Hardware e ferramentas
- Modelo local "Alice": gemma4 12B via Ollama numa RTX 5070 (12 GB de VRAM) num PC Windows; contexto de 32 mil tokens. Outros modelos disponíveis para testes futuros: qwen3.6 35B-A3B (MoE) e gpt-oss 20B.
- Desenvolvimento numa VM Debian 13 num servidor doméstico com Proxmox; a Alice é acessada pela rede local.
- Claude (Anthropic) via Claude Code como tech lead.
- Busca: API do Brave, restrita a documentação oficial (lista de domínios).
- Skills de terceiros (tech-leads-club/agent-skills, MIT) revisadas e fixadas por commit: coding-guidelines, the-judge, tactical-ddd, security-threat-model etc.

## Como funciona (arquitetura)
- Hierarquia Supervisor–Worker: Joel decide e aprova; Claude planeja, escreve testes e travas, revisa e comita; Alice implementa.
- Spec Driven: PRD (produto) → RFC (proposta técnica) → ADR (decisão). Regras com ID estável (RN-C03, CA-01, T-13). 16,7 mil palavras de documentação antes de qualquer linha de código. Só se implementa doc aprovado.
- TDD com separação de papéis: quem escreve o teste não implementa; testes ficam protegidos contra escrita da Alice.
- Harness próprio (Python, só stdlib + PyYAML, ~550 linhas): cartão de tarefa YAML (allowedPaths, protectedTests, checks, budget, kind, rules); ferramentas limitadas (ler/buscar no repo, escrever só onde o cartão deixa, editar trecho, ver diff, rodar checks fixos, buscar em doc oficial, perguntar ao Claude, finalizar). Sem shell livre, sem git, sem rede livre. `.env` ilegível.
- Verificação final pelo próprio ambiente: arquivos alterados ⊆ allowedPaths; varredura de marcadores proibidos no diff (any, @ts-ignore, eslint-disable, .only/.skip, console., TODO sem ID); todos os checks.
- "Nunca invente": dúvida → docs do projeto → doc oficial → ask_claude (pausa a tarefa; o Claude devolve só a resposta). Regra de negócio nunca vem da web.
- Retorno compacto ao Claude (status, arquivos, tentativas, tokens, lições): o ciclo de tentativa e erro fica na GPU.
- Política de travas como dado (`.agents/policy.yaml`), fonte única para harness e CI.
- Memória curada no repositório (lições, decisões menores, fichas de módulo): a Alice propõe lições no fim de cada tarefa, o Claude faz a curadoria.
- Papéis especializados viraram "modos" da Alice (implement, test-author, pre-review, docs, cards) em vez de novos agentes.
- Porteiro SSH (forced command) para a chave da Alice: só comandos do harness e leitura.

## Linha do tempo (superficial)
1. Modelagem do negócio a partir da planilha; PRD, 5 RFCs, 13 ADRs, glossário pt→código, pontos legais.
2. AGENTS.md (guia dos agentes) com travas por camada.
3. Harness v1 + tarefa de brinquedo (TOY-T01) para validar.
4. Auditoria da arquitetura de agentes (comparação com Supervisor–Worker, Spec Driven, AI-augmented TDD, Context Engineering, Memory-first).
5. V1 da auditoria: a Alice implementou 4 módulos do próprio harness a partir de testes do Claude (H-01..H-04) e rascunhou o README (H-05).
6. Harness movido para dentro do repositório (git subtree), protegido contra a própria Alice.

## Resultados medidos (ver dados.json)
- Mesma tarefa TOY-T01: 1ª versão 48 mil tokens da Alice (35 mil de saída); harness novo 33 mil (2,3 mil de saída), 21 s.
- `think` desligado: resposta simples de 301 → 14 tokens; 61 s → 9 s.
- V1: Claude ~45 mil tokens (estimado) × Alice 1,96 milhão (medido, custo zero de API). Cerca de 21 min no relógio.
- 5 tarefas: 4 aprovadas na verificação; 1 reprovada por falso positivo do próprio harness. 2 de 5 entregas precisaram de correção do Claude (formato de ID frouxo; regex corrompida que o teste não pegou).
- Custo de entrada cresce com o histórico: tarefa longa (23 chamadas) = 762 mil tokens de entrada.
- AGENTS.md: 2.422 → 1.154 palavras. 129 IDs de regra indexados. 27 testes do harness. Porteiro: 8 comandos testados, 3 permitidos, 5 negados.
- Erros encontrados: 2 falsos positivos do harness, 1 erro de integração do Claude, 1 regex corrompida pela Alice. Todos pegos por teste/verificação ou revisão.

## Produção deste estudo
- Gráficos: script escrito pela Alice (E-01, 74 s, 1ª tentativa). Ajustes (E-02): 1ª execução reprovada porque o Claude escreveu arquivos na mesma pasta durante a execução e porque o modelo montou mal chamadas de ferramenta com código grande; harness corrigido; 2ª execução aprovada em 45 s.
- Rascunho do artigo: Alice em 22 s (1.217 palavras, 4 erros factuais); versão final reescrita pelo Claude.

## Plano de entrega (cartões E0/E1)
- Validador de cartões (cards.py) escrito pela Alice a partir de testes do Claude (H-06): 54 s, 2 tentativas.
- Cartões num arquivo só, via ferramenta: 41 min, 2,6 milhões de tokens de entrada, sem terminar; o E0 gravado fugiu do plano.
- Mesmos cartões gerados por partes em modo texto (um par por pedido) e montados por script: 29 s, ~15 mil tokens; estrutura válida, mas 6 de 17 com critérios de pronto inventados, corrigidos pelo Claude.
- Lição: o modelo local rende em pedidos pequenos e fechados; sessões longas e saídas grandes degradam.

## Bancada de modelos (2026-11-15; ver bancada-modelos.md e bancada/analise.md)
- Mesmo harness, 4 modelos locais 100% na GPU de 12 GB com contexto de 32k: gemma 12B (base), Qwen 3.5 9B, Qwen 3.8 27B em ~2 bits, gpt-oss 20B. Cada um fez 3 repetições de 3 cartões de implementação e de 1 pré-revisão com 4 defeitos plantados.
- Implementação: dos 36 cartões, 34 foram dados como prontos, e os 34 estavam limpos na conferência do Claude. Os 2 que faltam são do gemma, que estourou o tempo, e o harness os marcou como falhos. Aprovados sem reprovação: Qwen 3.8 9/9, Qwen 3.5 8/9, gemma 2/9, gpt-oss 2/9.
- Velocidade de geração ≠ velocidade de entrega: o gemma gera 137 tok/s contra 51 do Qwen 3.8, mas leva 75 s por cartão contra 29.
- Pré-revisão: defeitos achados no arquivo certo (média, de 4): Qwen 3.5 2,3; gemma 1,7; Qwen 3.8 1; gpt-oss 0. O defeito coberto por check foi o mais achado (6 de 12).
- O portão de evidência recusou "ok" sem prova em 4 das 5 pré-revisões que falharam. Mas ele confere se a prova existe, não se sustenta o veredito, e 3 tipos de prova falsa passaram (LI-050).
- O gpt-oss às vezes gera uma chamada de ferramenta que o Ollama não consegue ler (HTTP 500). Na 1ª rodada isso derrubou 3 de 4 cartões. Depois da correção do harness (repetir a requisição em caso de 5xx, LI-049), 2 erros foram absorvidos sem perda.
- Calibragem: Qwen 3.8 em 8 bits (30 GB) não cabe na GPU; dividido entre GPU e CPU, roda a ~1 tok/s. Na versão de ~2 bits (9,6 GB) roda a 52 tok/s. O gpt-oss (14 GB) é o único que transborda da VRAM: 26 tok/s.

## Segundo agente revisor e economia de cota (2026-11-15, plano E4)
- Papéis: a Alice (Qwen 3.5 9B, local) escreve teste e código; a "Bia" (modelo gratuito via OpenRouter) só revisa cartão e teste antes do commit. Quem escreve não assina a revisão (o harness recusa as assinaturas "claude" e "alice").
- Restrição real do tier gratuito: 50 requisições por dia (não é o saldo em dólar). A GPU local não tem custo por chamada, então a regra virou "a GPU local primeiro".
- Três portões antes de gastar requisição: (1) checks mecânicos vermelhos → a Bia nem é chamada; (2) pré-revisão local na GPU, por consenso (até 3 amostras; só conta problema apontado por 2 na mesma linha, porque uma amostra sozinha inventou que `it.each` não existe); (3) cota lida antes de cada chamada, com reserva de 5.
- Reprovação vira arquivo (`docs/plano/revisao/<ID>.md`) e a próxima execução da Alice recebe esses problemas no prompt.
- Experimento T01/T02 (fakeCpf), braço A (Alice escreve o teste) × braço B (Bia escreve o teste): os dois barraram 6 de 6 mutantes; B saiu mais barato e mais rápido, mas foi uma repetição só.
- E4-T03 (testes de `redact`), em números:

| Execução | Resultado | Tempo | Tentativas | Chamadas | Requisições OpenRouter |
|---|---|---|---|---|---|
| Revisão do cartão | pré-revisão local achou dica ambígua; corrigida; Bia aprovou | - | - | - | 1 |
| 1ª entrega da Alice | checks verdes, mas 1 teste impossível e `JSON.parse` no lugar de `structuredClone`; barrada pela pré-revisão local | 150 s | 2 | 34 | 0 |
| 2ª entrega (com as notas da reprovação) | corrigiu o teste impossível, mas usou `as any` (57 erros de lint) e manteve o `JSON.parse`; cartão falhou; barrada pelo portão de checks | 694 s | 4 | 30 | 0 |

- Ganho medido: duas entregas ruins barradas sem gastar requisição; a cota do dia ficou em 39 de 50 durante toda a rodada.
- Custo: a 2ª entrega gastou 2,83 milhões de tokens de entrada e 37,7 mil de saída da Alice (custo zero de API), e o tempo subiu 4,6×. O Claude gastou ≈ 0,33 milhão de tokens equivalentes nessa leva.
- Limite observado: as notas da pré-revisão local vêm confusas, e duas delas contradiziam o critério de pronto (trocar o `toBe` de Date/Error). A suspeita, não verificada, é que notas ruins pioraram a 2ª entrega. A pré-revisão local serve de filtro barato; o portão final continua sendo a Bia.

### Rodadas seguintes do E4-T03 (15–16/11)

| Rodada | Resultado | Tempo | Tokens Alice (entrada) | Quem barrou e por quê |
|---|---|---|---|---|
| 3 | checks verdes | 86 s | 187 mil | Bia: `toEqual({...input})` não prova que a entrada ficou igual; faltava `structuredClone` |
| 4 | checks verdes | 77 s | 246 mil | ainda `JSON.parse`; o local reprovou, mas o filtro descartou a nota (sem crases) |
| 5 | falhou | 574 s | 2,95 milhões | 10 bloqueios: a ferramenta barrava 150 linhas por chamada e o validador aceitava 341 |
| 6 | checks verdes | 33 s | 32 mil | local aprovou errado; Bia: trocou `ownerCpf` por `cpf` e faltou o array aninhado |
| 7 | checks verdes | 33 s | 25 mil | Bia: `phoneNumber` não é chave sensível (não termina com `phone`) |
| 8 | checks verdes | 61 s | 153 mil | local, com razão: o teste redige `phonenumber` e mantém `phoneNumber`, que se contradizem ignorando caixa |

- Filtro de notas locais: a nota só vai para a Alice se citar, entre crases, algo que o pronto exige e o arquivo não tem; as outras ficam em "Descartadas". O filtro tirou 3 de 4 notas contrárias ao pronto, mas também descartou uma nota verdadeira escrita sem crases (rodada 4).
- Pré-revisão local de cartão: só ruído (4 reprovações seguidas, 2 reclamações reais). De teste: barra coisa certa às vezes, mas também aprova errado (rodada 6).
- A Bia também tem ruído: reprovou uma vez um cartão que já tinha aprovado.
- `structuredClone` exigia `@types/node` no apps/api. Virou regra (ADR-0010, emenda): tipagem forte em todo lugar possível, `@types/node` no código Node e nada de `any`. No TypeScript 6, `types` vem vazio por padrão, então é preciso declarar `"types": ["node"]`.
- Erro de harness (rodada 5): a mesma regra de tamanho em dois lugares, com dois números. Conserto em duas etapas. Primeiro, o limite por chamada passou a usar a conta do validador, e a ferramenta `append_file` passou a escrever arquivo grande em partes. Depois, a pedido do Joel ("não quero mais limite fixo"), todos os limites de tamanho passaram a sair de uma função só (`cards.size_model`), a partir da janela (`num_ctx`) e da resposta (`num_predict`) do perfil. No qwen35 (32k/8k): 341 linhas por chamada, 512 por arquivo (cabe inteiro numa leitura) e 21,5 mil caracteres de saída de ferramenta (antes 6 mil, o que cortava ao meio um teste de 265 linhas).
- Lição: quando o agente esbarra num limite, conserte o limite; encolher a entrega para caber (minha dica "abaixo de 100 linhas") corta cobertura.

#### Rodada 11: laço automático (`plan-run --rounds 3`), a Bia escreve (15/11, 23:55)

| Item | Medido |
|---|---|
| Quem escreveu | Bia (`assignee: bia`), checks verdes em 3 requisições (as 3 tentativas internas do `bia.py write`) |
| Rodadas do laço | 1 de 3: o portão final (pré-revisão local por consenso) parou como `error` (Alice local indisponível ou resposta sem JSON depois da 1ª amostra). Não houve reprovação nem nova rodada; o T04 foi pulado |
| Tempo | 208 s |
| Tokens Alice (local) | 3.625 entrada / 721 saída (1 amostra) |
| Tokens Bia | 10.343 entrada / 6.656 saída; 3 requisições; cota restante 27/50 |
| Custo do Claude nesta sessão | 34 turnos, custo ≈ 0,62M (implementar o laço + testes + medir), contra 330 turnos e ≈5M no modo manual (10 rodadas) |

- O laço cortou a orquestração do Claude: a leva inteira saiu de uma chamada e de uma leitura do retro.
- Furo do harness achado na medição: o retro não diz por que o portão deu `error` (o motivo só está no log da rodada, que o Claude não lê). Conserto em sessão própria: levar o motivo do `bia.py gate` ao retro e repetir a amostra local que falhar antes de desistir.

#### Rodada 12: portão consertado, `plan-run --rounds 3` (16/11, 00:03–00:10)

Conserto antes da rodada (9de0f20): a amostra local que falha (sem JSON, 5xx, timeout) repete até 2 vezes; o motivo curto do portão em `error` vai ao retro; `claude-usage` e `cost` somam os subagentes (`<sessão>/subagents/agent-*.jsonl`).

| Item | Medido |
|---|---|
| Resultado | E4-T03 `escalated` depois de 3 rodadas (Bia escreveu, checks verdes nas 3; o portão local reprovou as 3). E4-T04 pulado (dependência) |
| Tempo | 411 s (277 + 92 + 42) |
| Tokens Alice (local) | 27.754 entrada / 22.492 saída |
| Tokens Bia | 8.412 entrada / 9.268 saída; 5 requisições; cota restante 24/50 |
| Custo do Claude nesta sessão (subagente) | 30 turnos, custo ≈ 0,44M até a medição (conserto + testes + rodada), mais uns 3 turnos para anotar e commitar |

- Desta vez não houve `error`: as amostras locais voltaram com JSON.
- O portão local reprovou sem nenhum problema com apoio no pronto: as notas da última rodada caíram todas em "Descartadas" (regra 4 aplicada a `toEqual` com valor literal, que o pronto pede). A Bia reescreveu duas vezes sem nota útil; o retro mostra "(a revisão não deixou nota com apoio no pronto)".
- Falha de desenho achada: no `bia.py gate`, reprovação "sem consenso" e com zero problemas aceitos conta como reprovação e gasta rodada. Conserto em sessão própria (decisão do Joel): sem consenso → `escalated` direto, ou a Bia revisa como desempate.

## Orquestração por feature (2026-11-16)

Desenho em [orquestracao.md](../agents/orquestracao.md) e ADR-0014: a Bia escreve todos os testes da feature numa chamada e audita numa chamada; a Alice implementa local (`plan-run`); o Claude lê só `revisao-final.md` e o diff. Prova única com o harness congelado (085a5e5): `alice.py feature docs/plano/E4.yaml E4-F02 --stage all`, `ALICE_PROFILE=qwen35`, 00:35–00:52.

| Etapa | Status | Tempo | Tokens Alice (local) | Requisições Bia |
|---|---|---|---|---|
| 1 plano (Claude) | done (validador ok) | 0 s | - | 0 |
| 2 testes (Bia) | done: 7 de 7 cenários com teste, checks verdes de primeira, 0 reparos | 28 s | - | 1 (1.867 entrada / 2.007 saída) |
| 3 implementação (Alice) | failed: limite de chamadas de ferramenta (36 chamadas, 1 rodada) | 971 s | 2.475.963 entrada / 33.357 saída | 0 |
| 4 auditoria | não rodou (implementação não done; a Bia não é chamada) | - | - | 0 |
| 5 revisão (Claude) | não rodou | - | - | 0 |

| Comparação (E4-T03) | Requisições Bia | Turnos / custo do Claude | Resultado |
|---|---|---|---|
| Manual, 10 rodadas por cartão (15/11) | ≈10 | 330 turnos, ≈5M | teste nunca fechou |
| `plan-run --rounds 3`, rodadas 11 e 12 | 3 e 5 | 34 e 30 turnos, ≈0,6M e ≈0,4M | `error` e `escalated` |
| Por feature (esta prova) | 1 | 166 turnos, ≈3,07M (subagente inteiro: inventário, ADR, 4 passos de harness com 221 testes, migração, prova e medição) | teste aceito pelos checks na 1ª chamada; implementação falhou |

- Ganho medido: a etapa de testes, que em 12 rodadas por cartão nunca passou do portão, saiu com todos os checks verdes em 1 requisição e 28 s. Cota: 22 → 21 de 50.
- O custo do Claude desta sessão é de construção, não de operação: a prova em si custou ao Claude 1 disparo e 3 leituras (saída, `testes.md`, `estado.json`).
- Falha da prova: a Alice estourou o limite de chamadas do E4-T04 (orçamento do cartão) em 971 s e 2,5M de tokens de entrada; os testes da Bia ainda não foram auditados nem commitados. Não consertado (harness congelado); a implementação parcial ficou na árvore, sem commit.
- Cache: o prefixo da Bia (papel + plano + contrato do HEAD) ficou estável por construção (teste `test_prefix_is_identical_across_calls`), mas com 1 chamada não houve reaproveitamento a medir.

### Prova 2: E4-T04 dividido em dois cartões (16/11)

Decisão do Joel depois da prova 1: a Bia escreve e revisa os testes (o conflito de papéis do ADR-0014 está aceito); a Alice segue no formato feature; o Claude enfileira cartões do tamanho que a Alice consegue executar. O E4-T04 virou dois cartões: E4-T04 (sem recursão, cenários C1, C2, C3 e C7, check com `vitest -t`) e E4-T05 (recursão, C4 a C6, 100% de cobertura), cada um com 20 chamadas de orçamento.

| Item | Medido |
|---|---|
| Tamanho pelo `size_model` (qwen35) | 341 linhas por escrita e 86.016 caracteres de contexto; o stub tem 12 linhas e o teste 109 linhas (3.840 bytes juntos). O cartão original também cabia com folga |
| E4-T04 (metade da função) | failed: 35 chamadas (limite 20), 0 erros de ferramenta, 616 s, 1 rodada |
| Tokens Alice (local) | 1.923.003 entrada / 27.435 saída |
| E4-T05 | pulado (dependência falhou) |
| Bia | 0 requisições; cota 21/50 |
| Claude, acumulado desde 15/11 (sessão + subagentes, `alice.py cost`) | 647 turnos, custo ≈ 10,4M; ≈3,07M são a construção do fluxo por feature |

- Dividir não resolveu: com metade do trabalho, a Alice gastou quase o mesmo número de chamadas (35 contra 36), sem nenhum erro de ferramenta.
- O gargalo não é tamanho, é passo sem convergência. O `size_model` mede se o arquivo e a resposta cabem na janela, mas não mede quantos passos a tarefa pede; um cartão "pequeno" pelo modelo de tamanho ainda pode não fechar.
- Cada chamada reenvia o histórico: 35 chamadas viraram 1,9M de tokens de entrada para uma função de ~15 linhas. Na GPU local isso é tempo (10 min), não dinheiro.
- Hipótese não verificada: algum check do cartão nunca fica verde e a Alice repete. O Claude não abre o log do cartão nem roda o check por fora durante a entrega (regras do estudo), então o diagnóstico vai para uma sessão própria de conserto do harness, num cartão descartável.

### Achados até aqui (16/11)

1. O custo pago está nos turnos do Claude, não na IA local: 64% do custo é releitura de contexto. Tirar o Claude do laço entre rodadas (`plan-run --rounds`) cortou a leva de ≈5M para ≈0,4–0,6M.
2. Testes escritos por um modelo maior (Bia, OpenRouter) a partir de um plano com cenários numerados fecharam em 1 requisição o que 12 rodadas por cartão não fecharam.
3. Juiz local por consenso de amostras foi ruidoso: reprovou sem nota com apoio no pronto. Reprovação sem nota apoiada passou a ser inconclusiva, não rodada gasta.
4. Recorte certo não é só tamanho: o limite de passos importa tanto quanto o de linhas. A ferramenta de tamanho não basta para fatiar.
5. Construir o orquestrador custa caro uma vez (≈3M de Claude); só se paga quando as features passam a fechar. Até agora, nenhuma feature fechou a implementação.

## Ainda NÃO testado (conclusões pendentes)
- Geração de código TypeScript do produto (E1: motor financeiro; depois API, banco, frontend).
- Modo test-author (Alice escrevendo testes), pre-review, fila de tarefas, CI com todas as travas (lint, tipos, fronteiras, mutação).
- Comparação com o Claude fazendo a mesma tarefa sozinho (custo × qualidade × tempo).
