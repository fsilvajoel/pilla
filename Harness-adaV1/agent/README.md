# Agentes

Os papéis viraram **subagentes do Claude Code**, definidos em `../.claude/agents/` (fora desta pasta para o
Claude Code carregá-los sem configuração). Cada arquivo tem frontmatter `name`, `description` e `tools` e cita
as [policies](../policy/README.md) por caminho, sem copiar o texto delas.

| Subagente | Responsabilidade | Etapa do [workflow feature](../workflow/feature.md) |
|---|---|---|
| `planner` | escopo, contrato, critérios de aceite (A<n>) e cenários (C<n>); não escreve código | plan |
| `test-writer` | testes antes do código (skill escrever-teste); não toca código de produção | tests |
| `reviewer` | revisa os testes (skill revisar-teste) e o diff final; somente leitura | review-tests, final-review |
| `implementer` | implementa até os testes revisados passarem; nunca altera teste revisado | implement |

O **orquestrador** é a sessão principal do Claude Code: segue o checklist do workflow, chama os subagentes,
roda os gates e grava o estado. Não há outro papel.
