# Capability: code-modification

## Objetivo
Editar código com escopo limitado, validação a cada edição e diff revisável.

## Composição
- skill: [editar-arquivo](../skill/editar-arquivo/SKILL.md)
- tools: `tools/replace_function.py`, `tools/list_files.py`, `tools/search_code.py`, `tools/run_cmd.py`
- policies: [editing](../policy/editing.md), [quality](../policy/quality.md)
- gates: [edit-guard](../gate/edit-guard.md), [done-checks](../gate/done-checks.md)
