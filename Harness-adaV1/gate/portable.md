# Gate: portable

## Objetivo
Garantir que o harness possa ser levado para outro projeto sem referência fixa ao projeto original nem ao ambiente.

## Critério de sucesso (PASS)
Nenhum arquivo do harness contém um dos textos de `portable.forbidden` do `harness.project.yaml`
(nome do projeto alvo, caminhos absolutos de máquina, caminhos de pastas do projeto alvo).
O próprio `harness.project.yaml` é o único arquivo autorizado a contê-los.

## Critério de falha (FAIL)
- algum arquivo contém um texto proibido;
- o yaml não declara `portable.forbidden` (lista vazia não conta como aprovação).

## Evidência esperada
Saída de `python3 script/check_portable.py`: "Gate portable passou." ou uma linha por ocorrência
(`<arquivo> contém texto proibido: <texto>`). O mesmo resultado aparece em `ada.py --status` (`legacy_matches`).
