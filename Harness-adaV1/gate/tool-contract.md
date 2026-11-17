# Gate: tool-contract

## Objetivo
Garantir que cada tool declare um contrato mínimo da sua interface pública.

## Critério de sucesso (PASS)
Cada tool define um dicionário `TOOL_CONTRACT` com `name`, `purpose`, `inputs` e `outputs`, em texto ou em
dicionário que descreva a interface.

## Critério de falha (FAIL)
O arquivo da tool não tem `TOOL_CONTRACT` ou o contrato omite um dos campos obrigatórios.

## Evidência esperada
Saída de `python3 script/check_tool_contract.py`. O gate é estreito de propósito: valida o contrato, não a
semântica da tool.
