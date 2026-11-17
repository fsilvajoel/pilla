# Policy: delegation

## Objetivo
Delegar só depois que tentativas locais razoáveis falharem.

## Regras
- Tentar a correção local primeiro ([auto-validation](auto-validation.md)).
- Registrar a tentativa que falhou e o motivo.
- Escalar só com passagem clara: falha, tentativas, evidência, pedido.
- Manter a tarefa delegada estreita e com limite definido.
- Problema estrutural do harness vai para o papel platform ([workflow/delegation](../workflow/delegation.md)).
