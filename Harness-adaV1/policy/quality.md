# Policy: quality

## Objetivo
Garantir que o resultado seja testável, revisável e coerente com o plano.

## Regras
- **Validar antes de concluir.** Nenhum papel declara pronto sem rodar o menor comando que prova o resultado
  (chaves de `commands` do `harness.project.yaml`) e anexar a saída.
- **Escopo explícito.** Toda tarefa diz o que entra, o que fica fora e onde pode escrever (`allowedPaths`).
- **Evidência acima de suposição.** Afirmação sem saída de comando, arquivo e linha, ou fonte, não conta.
- Preservar o contrato funcional; não inventar comportamento fora dos critérios de aceite.
- Corrigir os próprios erros (lint, tipo, import) antes de passar adiante.
- Critério de aceite é frase verificável.
