# Gate: expect-red

## Objetivo
Provar que os testes novos testam algo: eles precisam falhar antes de existir implementação.

## Critério de sucesso (PASS)
Rodados contra o esboço (função que só lança erro), todos os testes novos falham, e falham pela asserção
ou pelo erro do esboço, não por erro de sintaxe, import ou tipo. `expectRed = true` no estado.

## Critério de falha (FAIL)
Algum teste novo passa contra o esboço, ou a falha vem de erro de compilação/import.

## Evidência esperada
Saída do comando `commands.test` contra o esboço, com o nome de cada teste e o motivo da falha.
