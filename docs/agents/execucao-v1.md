# Execução da V1 da auditoria (2026-11-14)

Origem: [auditoria-2026-11-14.md](auditoria-2026-11-14.md) §13. Tokens do Claude são **estimativa** (texto lido + escrito); tokens da Alice são **medidos** pelo Ollama (entrada / saída). Tempo = relógio.

| # | O que | Quem fez | Tokens Claude (est.) | Tokens Alice (entrada / saída) | Tempo | Status |
|---|---|---|---|---|---|---|
| 0 | Salvar a auditoria em `docs/agents/` | Claude | ~4 mil | — | 2 min | ✅ |
| 1 | Fechar o atalho do Windows: regra "código só via harness" (AGENTS.md §4, `NOTAS-ALICE.md`) + porteiro SSH `scripts/alice-gate.sh` testado | Claude | ~3 mil | — | 3 min | 🟡 parcial: falta o Joel criar uma chave SSH só da Alice no Windows e cadastrá-la com o porteiro |
| 2 | Índice de regras: `rules.py`, ferramenta `read_rule`, `rules: [IDs]` no cartão (injetado no pedido), `alice.py rule <ID>` | Alice implementou (H-01); Claude testes, revisão (ID por regex), integração | ~6 mil | 762 mil / 49 mil | 9 min (Alice) + 3 min | ✅ 129 IDs indexados no pilla |
| 3 | Memória v1: `docs/memoria/` (lições, decisões menores, modelo de ficha) + memória do Claude (estava vazia) + `lessons` no `finish` | Claude (estrutura); Alice propõe lições a cada tarefa | ~3 mil | — | 3 min | ✅ |
| 4 | Fonte única de travas: `policy.default.yaml` + `policy.py` no harness; `.agents/policy.yaml` no pilla | Alice implementou (H-02); Claude testes, correção da regex do TODO, isenção da varredura | ~5 mil | 969 mil / 43 mil | 8 min (Alice) + 2 min | ✅ (a execução da Alice terminou "failed" por falso positivo do harness, LI-005; código aceito após 1 linha de correção) |
| 5 | `edit_file`, `view_diff`, rodada obrigatória de refatoração, aviso de cartão sem lint, tipos de tarefa (`kind`) | Alice implementou `edits.py` (H-03); Claude testes + integração no `alice.py` | ~8 mil | 29 mil / 1,6 mil | 22 s (Alice) + 6 min | ✅ |
| 6 | Métricas (`runs/metrics.jsonl`, `alice.py metrics`) + ajuste do raciocínio (`think: false`, `maxOutputTokens`) | Alice implementou `metrics.py` (H-04); Claude testes, medição do `think`, integração | ~3 mil | 11 mil / 0,9 mil | 9 s (Alice) + 3 min | ✅ |
| 7 | Dividir o AGENTS.md: núcleo 2.422 → 1.154 palavras; detalhes em `travas.md`, `cartao-de-tarefa.md`, `revisao.md` | Claude (recorte por script, sem reescrever o conteúdo) | ~5 mil | — | 5 min | ✅ |
| 8 | README do harness atualizado | Alice rascunhou (H-05, `kind: docs`); Claude corrigiu 3 linhas | ~1 mil | 59 mil / 0,8 mil | 12 s | ✅ |
| 9 | Validação ponta a ponta (TOY-T01 com o harness novo) | Alice | ~1 mil | 31 mil / 2,3 mil | 21 s | ✅ usou `read_rule`, `view_diff`, `edit_file`, refatoração e lições |

**Totais:** Claude ~40 a 50 mil tokens (incluindo ler o `alice.py`, ~6 mil). Alice 1,86 milhão de entrada / 98 mil de saída, de graça na GPU. Cerca de 21 min no relógio.

**Antes × depois (mesma tarefa TOY-T01):** 48 mil → 33 mil tokens da Alice; saída 35 mil → 2,3 mil; tempo ~10 min → 21 s.

## Pendências
- Chave SSH só da Alice + porteiro (decisão do Joel; ver `NOTAS-ALICE.md`).
- V2: `test-author` com mutação, fila com cópia isolada por tarefa, `pre-review`, tarefas-padrão do harness, compactação de contexto mais cedo (LI-007).
