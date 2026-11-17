# Gate: testes-revisados

## Objetivo
Garantir que a implementação rode contra exatamente os testes que foram revisados.

## Critério de sucesso (PASS)
Todo arquivo de teste listado em `testShas` do [estado](../workflow/feature-artefatos/estado.md) tem hoje o
mesmo sha de blob registrado na revisão ([testes.md](../workflow/feature-artefatos/testes.md)).

## Critério de falha (FAIL)
Arquivo de teste ausente, sha diferente do revisado ou feature sem revisão de testes registrada.
Teste alterado depois da revisão derruba a revisão: volta para a etapa de revisão dos testes.

## Evidência esperada
Comparação arquivo a arquivo: caminho, sha registrado, sha atual.
