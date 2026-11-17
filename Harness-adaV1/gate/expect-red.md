# Gate: expect-red

## Objetivo
Provar que os testes novos testam algo: eles precisam falhar antes de existir implementação.

## Comando
`pnpm gate expect-red <feature>` (`scripts/gates.mts`). Roda o vitest, no pacote de cada arquivo, só nos testes
listados em `tests` do [estado](../workflow/feature-artefatos/estado.md) e grava o resultado em
`gates.expect-red`.

## Critério de sucesso (PASS)
Todo arquivo listado existe, executou ao menos um teste e **todos** os testes falharam (contra o esboço).

## Critério de falha (FAIL)
- estado ausente ou sem `tests`; arquivo listado inexistente ou fora de pacote;
- vitest sem relatório; arquivo sem nenhum teste executado (erro de import ou sintaxe);
- algum teste passou sem implementação;
- teste pulado ou `todo`: **pular é FAIL**.

## Evidência esperada
`gates.expect-red = {status, at, detail}` no estado e a saída do comando, que lista o que faltou.
