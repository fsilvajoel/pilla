# Capability: testing

## Objetivo
Definir e validar o comportamento esperado em testes antes de a implementação ser aceita.

## Composição
- skills: [escrever-teste](../../.claude/skills/escrever-teste/SKILL.md),
  [revisar-teste](../../.claude/skills/revisar-teste/SKILL.md)
- subagentes: [test-writer](../../.claude/agents/test-writer.md), [reviewer](../../.claude/agents/reviewer.md)
- policy: [quality](../policy/quality.md)
- gates: [expect-red](../gate/expect-red.md), [testes-revisados](../gate/testes-revisados.md),
  [cobertura](../gate/cobertura.md), [auditoria](../gate/auditoria.md)
- artefatos: [testes.md](../workflow/feature-artefatos/testes.md), [auditoria.md](../workflow/feature-artefatos/auditoria.md)
