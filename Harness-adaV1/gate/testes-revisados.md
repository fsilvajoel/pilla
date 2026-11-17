# Gate: testes-revisados

## Objetivo
Garantir que a implementação rode contra exatamente os testes que foram revisados.

## Comando
- Ao aprovar a revisão dos testes: `pnpm gate tests-reviewed <feature> --sign`. Exige `gates.expect-red` em PASS e
  grava em `testShas` o sha de blob (`git hash-object`) de cada arquivo de `tests`.
- Depois da implementação: `pnpm gate tests-reviewed <feature>` compara os shas atuais com os assinados.

Comando em `scripts/gates.mts`; o resultado vai para `gates.tests-reviewed` no
[estado](../workflow/feature-artefatos/estado.md).

## Critério de sucesso (PASS)
Todo arquivo de `tests` tem sha assinado e o sha atual é igual ao assinado.

## Critério de falha (FAIL)
- `testShas` ausente ou vazio (revisão não assinada); `--sign` sem expect-red em PASS;
- arquivo de teste ausente, sem sha assinado (teste novo) ou com sha diferente;
- sha assinado de arquivo que saiu de `tests`.

Teste alterado depois da revisão derruba a revisão: volta para a etapa de revisão dos testes.

## Evidência esperada
Saída do comando, arquivo a arquivo, com o motivo de cada FAIL.
