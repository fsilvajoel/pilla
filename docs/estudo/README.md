# Estudo: harness híbrido IA local + Claude

Material para um artigo em série (Medium/LinkedIn) sobre construir o pilla com o Claude como tech lead e um modelo local (Alice) como desenvolvedora.

| Arquivo | O que é |
|---|---|
| [artigo-parte-1.md](artigo-parte-1.md) | Parte 1 (fundação): rascunho vivo, conclusões **parciais** |
| [achados.md](achados.md) | resumo dos achados da orquestração Claude + Bia + Alice (16/11), base para o estudo de caso |
| [fatos.md](fatos.md) | ficha de fatos: única fonte permitida para o texto (tudo aqui pode ser público) |
| [dados.json](dados.json) | métricas medidas (tokens da Alice pelo Ollama; tokens do Claude estimados) |
| [bancada-modelos.md](bancada-modelos.md) | bancada: o mesmo harness em 4 modelos locais (gerado por [bancada.py](bancada.py)); leitura em [bancada/analise.md](bancada/analise.md) |
| [graficos.py](graficos.py) | gera os PNGs em `graficos/` a partir de `dados.json` (`python3 docs/estudo/graficos.py`, precisa de matplotlib) |

## Como o material foi feito
| Peça | Quem fez |
|---|---|
| Dados e ficha de fatos | Claude (a partir dos registros `runs/` do harness) |
| Script dos gráficos | Alice (E-01, E-02, pelo harness); Claude revisou as imagens |
| Rascunho do artigo | Alice (22 s, 1.217 palavras) |
| Versão do artigo | Claude reescreveu sobre o esqueleto da Alice (4 erros factuais corrigidos) |

## Atualizar
1. Nova medição → acrescente em `dados.json` e em `fatos.md`.
2. Rode `graficos.py`.
3. Partes novas do artigo só com fatos da ficha; o que não foi medido fica `[PENDENTE]`.
4. Nada de IP, nome de servidor, chave ou dado pessoal (repositório público).

## Pendente para fechar as conclusões
- E1: geração de código TypeScript (motor financeiro) pela Alice.
- Modo `test-author`, `pre-review`, CI com todas as travas.
- Comparação: mesma tarefa feita só pelo Claude (custo × qualidade × tempo).

## Arquivo histórico (18/11/2026)
Material salvo das worktrees e branches antigas antes de apagá-las. A história do harness antigo (`alice-harness`, Jorge, cartões) vale para o artigo; nada disso está em uso hoje. Os IDs de geração do OpenRouter viraram `<gen-id>` e o número da VM virou `<vm>`.

| Pasta / arquivo | O que é | Origem |
|---|---|---|
| [harness-antigo/relatorios-jorge/](harness-antigo/relatorios-jorge/) | relatórios `harness-v1` a `harness-v17` (sem v7) do revisor Jorge, um por versão do harness | `refactor/harness-tools` (`tools/jorge/logs/`; v1 a v16 também em `jorge/harness-v17` e `harness/bia-pacote`) |
| [harness-antigo/agents/auditoria-2026-11-14.md](harness-antigo/agents/auditoria-2026-11-14.md) | auditoria da arquitetura de agentes | todas as branches (`docs/agents/`) |
| [harness-antigo/agents/execucao-v1.md](harness-antigo/agents/execucao-v1.md) | execução da V1 da auditoria, com tokens e tempo | todas as branches (`docs/agents/`) |
| [harness-antigo/agents/orquestracao.md](harness-antigo/agents/orquestracao.md) | desenho da orquestração por feature (Claude, Bia, Alice) | `refactor/harness-tools`, `harness/bia-pacote` |
| [harness-antigo/agents/orquestracao.jorge-harness-v17.md](harness-antigo/agents/orquestracao.jorge-harness-v17.md) | outra versão do mesmo arquivo | `jorge/harness-v17` |
| [harness-antigo/agents/propostas/](harness-antigo/agents/propostas/) | `plano-fluxo.md` e `plano-dor-dod.md` (propostas de 17/11, com números das execuções) | `refactor/harness-tools`, `harness/bia-pacote` |
| [harness-antigo/memoria/decisoes-menores.md](harness-antigo/memoria/decisoes-menores.md) | decisões menores DM-001 em diante | todas as branches (`docs/memoria/`) |
| [harness-antigo/NOTAS-ALICE.md](harness-antigo/NOTAS-ALICE.md) | notas de handoff Claude ↔ Alice | todas as branches (raiz) |
| [harness-antigo/jorge-modelagem/](harness-antigo/jorge-modelagem/) | `pedido-gpt6.md` (pedido de modelagem do Jorge) e `notas-runner.md` | `refactor/harness-tools` (`tools/jorge/modelagem/`) |
| [harness-antigo/revisoes-bia/](harness-antigo/revisoes-bia/) | revisões da Bia de E4-T03 e E4-T08 | `refactor/harness-tools` (`docs/plano/revisao/`) |
| [harness-antigo/runs/refactor-harness-tools/](harness-antigo/runs/refactor-harness-tools/) | `metrics.jsonl` e 14 `retro-*.md` das execuções E90 (17/11) | worktree `.wt-harness-tools`, não rastreado (`tools/alice-harness/runs/`) |
| [harness-antigo/runs/bench-t23-v4/](harness-antigo/runs/bench-t23-v4/) | `metrics.jsonl` e retro da bancada E2-T23 (15/11) | worktree `pilla-bench`, não rastreado |
| [harness-antigo/runs/jorge-harness-v17/](harness-antigo/runs/jorge-harness-v17/), [harness-antigo/runs/harness-bia-pacote/](harness-antigo/runs/harness-bia-pacote/) | `metrics.jsonl` de cada worktree | worktrees `.jorge-wt/harness-v17` e `.claude/worktrees/agent-…`, não rastreados |
| [harness-antigo/harness-adav1-plano-inicial.md](harness-antigo/harness-adav1-plano-inicial.md) | primeiro plano de reestruturação que virou o Harness-adaV1 | worktree `.wt-harness-tools`, não rastreado (`docs/plano/harness-adav1.md`) |
| [exp/e4-t01-a/E4-T01.md](exp/e4-t01-a/E4-T01.md), [exp/e4-t01-b/E4-T01.md](exp/e4-t01-b/E4-T01.md) | experimento A/B: revisão da Bia sobre o teste de `fakeCpf` em duas variantes | `exp/e4-t01-a`, `exp/e4-t01-b` |

As branches `bench/*` só tinham código gerado pelos modelos na bancada. Os resultados delas já estão em `bancada/` e `bancada-modelos.md`.
