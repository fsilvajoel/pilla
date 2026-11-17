# Gate: auditoria

## Objetivo
Garantir que um papel independente confirmou que os testes cobrem os critérios de aceite.

## Critério de sucesso (PASS)
[auditoria.md](../workflow/feature-artefatos/auditoria.md) com veredito `aprovado`, checks verdes e
expect-red registrado como verdadeiro.

## Critério de falha (FAIL)
Veredito `reprovado`, auditoria ausente, check vermelho ou lacuna aberta em critério de aceite.

## Evidência esperada
`stages.audit.verdict = "aprovado"` e `checksGreen = true` no [estado](../workflow/feature-artefatos/estado.md).
