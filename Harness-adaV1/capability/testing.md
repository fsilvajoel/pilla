# Capability: testing

## Objetivo
Definir e validar o comportamento esperado em testes antes de a implementação ser aceita.

## Composição
- skills: [escrever-teste](../skill/escrever-teste/SKILL.md), [revisar-teste](../skill/revisar-teste/SKILL.md)
- tools: `tools/run_cmd.py` (roda `commands.test` e `commands.coverage`), `tools/search_code.py`
- policy: [quality](../policy/quality.md)
- gates: [expect-red](../gate/expect-red.md), [testes-revisados](../gate/testes-revisados.md),
  [cobertura](../gate/cobertura.md), [auditoria](../gate/auditoria.md)
- artefatos: [testes.md](../workflow/feature-artefatos/testes.md), [auditoria.md](../workflow/feature-artefatos/auditoria.md)
