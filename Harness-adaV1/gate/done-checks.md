# Gate: done-checks

## Objetivo
Confirmar que a feature está de fato pronta antes de declará-la concluída.

## Comando
`pnpm verify` (lint, tipos, testes, cobertura e checks do repositório; código de saída 0 = PASS).

## Critério de sucesso (PASS)
`pnpm verify` sai com código 0, os gates por script da feature estão em PASS no
[estado](../workflow/feature-artefatos/estado.md) e o diff é não vazio e fica no escopo do plano.

## Critério de falha (FAIL)
Check vermelho ou não rodado, gate em FAIL, escrita fora do escopo do plano ou diff vazio.

## Evidência esperada
Saída do `pnpm verify` e a tabela "Gates" de `revisao.md`
([modelo](../workflow/feature-artefatos/revisao-final.md)) preenchida.
