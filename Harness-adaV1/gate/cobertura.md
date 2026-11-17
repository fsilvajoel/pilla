# Gate: cobertura

## Objetivo
Garantir que os arquivos tocados pela implementação foram de fato exercitados pelos testes.

## Critério de sucesso (PASS)
O relatório de `commands.coverage` traz cada arquivo de implementação tocado, com total de linhas maior
que zero e as linhas cobertas informadas.

## Critério de falha (FAIL)
Relatório ausente, arquivo tocado fora do relatório ou cobertura vazia: **0/0 é falha**, nunca sucesso.

## Evidência esperada
Linha "Cobertura dos arquivos tocados: x/y" em [revisao-final.md](../workflow/feature-artefatos/revisao-final.md),
com y > 0 para cada arquivo.
