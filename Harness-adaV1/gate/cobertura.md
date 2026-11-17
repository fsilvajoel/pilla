# Gate: cobertura

## Objetivo
Garantir que o código da feature foi exercitado pelos testes e que os limites de cobertura do pacote valem.

## Comando
`pnpm gate coverage <feature>` (`scripts/gates.mts`). Em cada pacote que contém testes listados em `tests` do
[estado](../workflow/feature-artefatos/estado.md), roda a suíte do vitest com cobertura; os limites
(`thresholds`) são os do `vitest.config` do pacote. Resultado em `gates.coverage`.

## Critério de sucesso (PASS)
Vitest sai com código 0 (limites atendidos), todos os testes passam, nenhum é pulado, todo teste da feature
rodou e o total de linhas medido é maior que zero.

## Critério de falha (FAIL)
- nenhum teste executado; teste falhando; teste pulado ou `todo` (**pular é FAIL**);
- teste da feature fora do relatório;
- `coverage-summary.json` ausente ou cobertura vazia: **0/0 é falha**, nunca sucesso;
- limite de cobertura não atendido.

## Evidência esperada
`gates.coverage` no estado e a linha do gate na tabela "Gates" de `revisao.md`
([modelo](../workflow/feature-artefatos/revisao-final.md)).
