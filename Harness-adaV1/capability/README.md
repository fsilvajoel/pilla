# Capabilities

Comportamentos completos e reutilizáveis. Uma capability junta skills (conhecimento), subagentes (execução),
policies (regras) e gates (aprovação). Formato: [_modelo.md](_modelo.md).

As skills ficam em `.claude/skills/` na raiz do repositório (fonte única) e os subagentes em `.claude/agents/`.

| Capability | Skills | Subagente |
|---|---|---|
| [planning](planning.md) | — | planner |
| [testing](testing.md) | escrever-teste, revisar-teste | test-writer, reviewer |
| [code-modification](code-modification.md) | editar-arquivo | implementer |
