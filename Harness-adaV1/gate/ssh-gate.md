# Gate: ssh-gate

## Objetivo
Impedir uso genérico de shell em operações privilegiadas, exigindo um perfil de execução estreito.

## Critério de sucesso (PASS)
O comando roda pelo portão do projeto e está na lista de operações aprovadas.

## Critério de falha (FAIL)
O comando escapa do portão, tenta executar comando arbitrário ou usa um caminho SSH não aprovado.

## Evidência esperada
Registro do portão com o comando e a regra da lista que o aprovou. Não há executor dentro do harness;
`run_checks.py` marca este gate como `skipped`. Regra de fundo: [policy/security.md](../policy/security.md).
