# Policy: auto-validation

## Objetivo
Garantir que cada etapa seja validada localmente antes de voltar ao orquestrador.

## Regras
- Rodar os checks da etapa (chaves de `commands` do `harness.project.yaml` e os gates do workflow) antes de
  devolver o resultado.
- Corrigir localmente o que se resolve com correção estreita (lint, tipo, import).
- Quando não der para resolver, devolver ao orquestrador a falha, o que foi tentado e a saída do check como
  evidência; nunca contornar trava (hook, gate, lint) para "fazer passar".
