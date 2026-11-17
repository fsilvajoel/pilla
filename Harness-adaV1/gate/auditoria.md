# Gate: auditoria (manual)

## Objetivo
Garantir que um papel independente confirmou que os testes cobrem os critérios de aceite e que a implementação
cumpre o plano.

## Executor
**Manual**: subagente `reviewer` na revisão final. Não há script; o orquestrador só avança com o veredito
registrado.

## Critério de sucesso (PASS)
`revisao.md` (modelos [testes](../workflow/feature-artefatos/auditoria.md) e
[final](../workflow/feature-artefatos/revisao-final.md)) com veredito `aprovado`, sem lacuna aberta em
critério de aceite, e os gates por script em PASS (`expect-red`, `tests-reviewed`, `coverage`).

## Critério de falha (FAIL)
Veredito `reprovado`, auditoria ausente, gate por script em FAIL ou lacuna aberta em critério de aceite.

## Evidência esperada
`stages.review.verdict = "aprovado"` no [estado](../workflow/feature-artefatos/estado.md).
