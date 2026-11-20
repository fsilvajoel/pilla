Você vai MODELAR um agente de IA chamado **Jorge**. Responda em português do Brasil.

# Contexto
Projeto `pilla` (monorepo TypeScript, dono: Joel). Agentes:
- **Alice**: modelo local pequeno (Qwen 3.5 9B no Ollama) que implementa "cartões" de tarefa (até 2 arquivos, uma função ou tabela).
- **Bia**: revisora/escritora de testes (Nemotron via OpenRouter, cota de 50 req/dia; orçamento `biaBudget` é do Joel).
- **Claude**: tech lead; escreve cartões, revisa no fim, commita.
- **Joel**: dono; aprova mudanças de travas/orçamento.

O **harness** (`tools/alice-harness/`, Python, ~4000 linhas, 231 testes unittest) executa a Alice e a Bia: valida cartões (`cards.py`), monta o pedido, dá ferramentas ao modelo, aplica portões (`gates.py`, escopo, prettier, checks), orquestra features (`feature.py`, Bia escreve testes → Alice implementa → Bia audita), mede (`metrics.py`, `retro.py`, `claude_usage.py`), política em `policy.default.yaml` + `.agents/policy.yaml`, hook de guarda do Claude em `scripts/guard_hook.py`. Retrospectivas em `runs/retro-*.md`, estudo em `docs/estudo/`, regras de cartão em `docs/agents/cartao-de-tarefa.md`.

## Problema que motivou o Jorge
O Claude gastou muitos tokens (até 4× fazer a tarefa direto) consertando o harness no meio das entregas, e errou repetidamente. Erros registrados: escrever a solução no cartão; abrir logs no meio da fila; simular portões; não avisar que a tarefa não compensava; cartão que induz erro; mexer no harness durante a entrega; reportar custo menor que o real; inflar o orçamento da Bia e editar o contador `estado.json`; mesmo limite de tamanho em dois lugares com números diferentes (regra: todo limite de tamanho sai de `cards.size_model(card, profile)`, nunca constante solta); check de cobertura 0/0 passar verde. Lição central do Joel: **regra só em memória não segura; o que vale é bloqueio mecânico (hook, validação no harness, teste).**

## Decisão do Joel
A partir de agora o **Jorge é o ÚNICO agente que altera o harness**. O Claude fica proibido (bloqueio por hook). Jorge roda via API (Abacus RouteLLM, modelo GPT-6). A cada **Review do processo** (fim de uma leva/feature), Jorge:
1. recebe o escopo (o que aconteceu: retro, problemas listados, pedidos do Joel);
2. analisa o harness e entende como melhorá-lo;
3. gera um **relatório de versão** (harness-vN) com as evoluções propostas;
4. aplica as evoluções, com teste, e o runner commita se a suíte ficar verde.

## Runner (eu, Claude, vou escrever em Python; considere estas ferramentas e limites)
Ferramentas do Jorge (function calling, formato OpenAI):
- `list_files(path)`, `read_file(path, start?, end?)`, `search_code(pattern, path?)` — leitura do repositório inteiro, exceto `.env` e `tools/alice-harness/runs/` fora de `retro-*`.
- `run_tests()` — roda `python3 -m unittest discover -s tests` no harness e devolve o resumo/falhas.
- `write_file(path, content)`, `edit_file(path, old, new)` — SÓ na fase de aplicação e SÓ em: `tools/alice-harness/**` (exceto `runs/`, `.env`), `docs/agents/**`, `.agents/policy.yaml`. Proibido sempre: `.claude/**`, `docs/plano/**/estado.json`, `tools/jorge/**`, código do produto (`apps/`, `packages/`).
- `submit_report(markdown)` — fim da fase de análise.
- `finish(summary)` — fim da fase de aplicação.
Fases: (1) ANÁLISE (só leitura) → relatório; (2) APLICAÇÃO (escrita) → finish. O runner roda a suíte no fim; verde = commit `feat(harness): harness-vN ...` com o relatório em `tools/jorge/relatorios/harness-vN.md`; vermelho = reverte tudo e grava o relatório como "não aplicado" com o diff.
Mudanças em travas (guard_hook, orçamento da Bia, política de segurança) vão marcadas no relatório como "trava — auditoria do Joel".

# O que eu quero de você
Entregue EXATAMENTE três blocos, cada um entre as linhas `=== ARQUIVO: <nome> ===` e `=== FIM ===`:

1. `jorge.md` — o prompt de sistema do Jorge (identidade, missão, princípios, o que ele nunca faz, método de análise passo a passo, critérios para priorizar evoluções, como escrever cada evolução, regras de aplicação: uma evolução por vez, teste junto, rodar `run_tests` após cada uma, não quebrar compatibilidade de CLI sem dizer, mudança mínima, sem constante solta de tamanho, preferir bloqueio mecânico a texto, não inflar orçamentos, nunca tocar no `estado.json`; quando parar e devolver ao Joel). Seja concreto e operacional, não genérico. Máx. ~1500 palavras.
2. `relatorio-modelo.md` — modelo do relatório de versão (cabeçalho com versão, data, escopo recebido, base git; diagnóstico; tabela de evoluções com ID `JV<n>-<k>`, problema, evidência (arquivo:linha ou retro), mudança, arquivos, teste que prova, risco, tipo [correção|trava|métrica|simplificação], status [aplicada|adiada|recusada]; o que ficou para o Joel decidir; resultado da suíte; custo da execução do Jorge em tokens).
3. `notas-runner.md` — até 15 recomendações objetivas para o runner (riscos, limites de passos, como evitar laço, como medir custo, como dar contexto barato ao Jorge), para eu avaliar.
