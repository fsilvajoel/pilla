# Gate: done-checks

## Objetivo
Confirmar que um cartão está de fato pronto antes de declará-lo concluído.

## Critério de sucesso (PASS)
Cada item do `done` do cartão tem evidência (check verde, arquivo e linhas) e todos os comandos de `checks`
(chaves de `commands` no `harness.project.yaml`) saíram com código 0. Diff não vazio, só em `allowedPaths`.

## Critério de falha (FAIL)
Algum check vermelho ou não rodado, item do `done` sem evidência, escrita fora de `allowedPaths`,
diff vazio ou resposta `NO_CHANGE`.

## Evidência esperada
Tabela "Pronto por cartão" de [revisao-final.md](../workflow/feature-artefatos/revisao-final.md) preenchida
e `stages.implement.cards.<ID> = done` no [estado](../workflow/feature-artefatos/estado.md).
