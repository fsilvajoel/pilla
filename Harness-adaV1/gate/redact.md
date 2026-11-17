# Gate: redact

## Objetivo
Garantir que material com cara de segredo seja mascarado antes de chegar a log ou à saída de um modelo.

## Critério de sucesso (PASS)
Valores com forma de chave de API, token ou senha são trocados por um marcador neutro.

## Critério de falha (FAIL)
Texto com forma de credencial aparece sem máscara na saída ou no log.

## Evidência esperada
`tools/redact.py` aplicado ao texto devolve o marcador no lugar do valor; `tests/test_redact.py` verde.
