# Gate: edit-guard

## Objetivo
Impedir escrita fora do escopo da tarefa ou em artefatos protegidos da execução.

## Critério de sucesso (PASS)
Toda escrita fica dentro da lista de caminhos permitidos (`allowedPaths`) e não toca saídas protegidas.

## Critério de falha (FAIL)
Escrita ou comando tenta tocar caminho protegido (ex.: `runs/`, arquivo gerado) ou caminho fora do escopo.

## Evidência esperada
Decisão de `script/guard_hook.py` para o evento (permitido ou bloqueado, com motivo).
Regra de fundo: [policy/editing.md](../policy/editing.md).
