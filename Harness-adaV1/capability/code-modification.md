# Capability: code-modification

## Objetivo
Editar código com escopo limitado, validação a cada edição e diff revisável.

## Composição
- skill: [editar-arquivo](../../.claude/skills/editar-arquivo/SKILL.md)
- subagente: [implementer](../../.claude/agents/implementer.md)
- policies: [editing](../policy/editing.md), [quality](../policy/quality.md)
- gates: [testes-revisados](../gate/testes-revisados.md), [cobertura](../gate/cobertura.md),
  [done-checks](../gate/done-checks.md)
